import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";

/**
 * POST /api/consultations/[id]/read
 * Marks the astrologer's unread messages readAt=now (called while the chat
 * is open). Own consultations only. → { updated: number }
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  const consultation = await db.consultation.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true },
  });
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  const result = await db.message.updateMany({
    where: { consultationId: consultation.id, senderRole: "astrologer", readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ updated: result.count });
}
