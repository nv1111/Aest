import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { consultationDTO, settleConsultation } from "../../_shared";
import { relayStatus } from "@/lib/relay";

/**
 * POST /api/consultations/[id]/end
 *
 * Phase 2 lifecycle:
 * - status "requested" (not yet accepted) → CANCELLED by the user: nothing is
 *   billed, consultation:status "cancelled" relayed, notification sent,
 *   → { consultation } with status "cancelled"
 * - status "active" → settlement via the shared settleConsultation()
 *   (also used by the astrologer console end route): wallet debit, minutes,
 *   cap-at-balance, LLM summary with 8s ceiling, notification to the USER,
 *   consultation:ended + consultation:status "ended" relays
 *   → { consultation }
 * - anything else → 409
 */

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  let consultation = await db.consultation.findFirst({
    where: { id, userId: auth.user.id },
    include: { astrologer: true },
  });
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  // requested → cancelled by the user (nothing billed)
  if (consultation.status === "requested") {
    const flip = await db.consultation.updateMany({
      where: { id: consultation.id, status: "requested" },
      data: { status: "cancelled" },
    });
    if (flip.count > 0) {
      await db.notification.create({
        data: {
          userId: auth.user.id,
          type: "consultation_update",
          title: "Request cancelled",
          body: "You cancelled this request before it was accepted. Nothing was charged.",
          dataJson: JSON.stringify({ consultationId: consultation.id }),
        },
      });
      relayStatus(consultation.id, "cancelled");
      const cancelled = await db.consultation.findUnique({
        where: { id: consultation.id },
        include: { astrologer: true },
      });
      return ok({ consultation: consultationDTO(cancelled ?? consultation) });
    }
    // the request was accepted concurrently — fall through to the active path
    consultation =
      (await db.consultation.findFirst({
        where: { id, userId: auth.user.id },
        include: { astrologer: true },
      })) ?? consultation;
  }

  if (consultation.status !== "active") {
    return fail(409, "consultation_ended", "This consultation has already ended.");
  }

  const settled = await settleConsultation(consultation.id);
  if (!settled) {
    return fail(409, "consultation_ended", "This consultation has already ended.");
  }

  return ok({ consultation: consultationDTO(settled) });
}
