import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { consultationDTO, messageDTO, promoteStaleRequest } from "../_shared";

/**
 * GET /api/consultations/[id] → { consultation, messages, review }
 * Own consultations only (404 otherwise). Messages oldest-first.
 * `review` is the caller's own rating for this consultation (or null).
 *
 * Works for every status incl. "requested" (the waiting state). Stale
 * bot-mode requests (>30s, no manualMode) are auto-accepted here first —
 * heals requests orphaned by a dev-server restart.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // stale bot-mode requests self-heal (dev-server restarts lose the timer)
  if (consultation.status === "requested") {
    consultation = (await promoteStaleRequest(consultation)) ?? consultation;
  }

  const messages = await db.message.findMany({
    where: { consultationId: consultation.id },
    orderBy: { createdAt: "asc" },
  });

  const review = await db.review.findUnique({
    where: { consultationId: consultation.id },
  });

  return ok({
    consultation: consultationDTO(consultation),
    messages: messages.map(messageDTO),
    review: review
      ? {
          id: review.id,
          authorName: review.authorName,
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt.toISOString(),
        }
      : null,
  });
}
