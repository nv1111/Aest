import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { makeRelayTicket } from "@/lib/relay";

/**
 * POST /api/consultations/[id]/ticket → { ticket }
 * Ownership is verified before minting the HMAC ticket for the socket relay.
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

  return ok({ ticket: makeRelayTicket(consultation.id, auth.user.id) });
}
