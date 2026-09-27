import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { makeRelayTicket } from "@/lib/relay";
import { requireConsoleAstrologer, isGuardFailure } from "../../../_shared";

/**
 * POST /api/astrologer-console/consultations/[id]/ticket → { ticket }
 *
 * HMAC relay ticket for the console persona to join the consultation's socket
 * room. Minted for the CONSOLE USER's own userId (the relay verifies
 * `${consultationId}:${userId}`) — the customer's socket hook filters typing/
 * read events only by its own userId, so console traffic shows up correctly.
 * Ownership (any status) is verified before minting.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const { id } = await params;
  const consultation = await db.consultation.findUnique({
    where: { id },
    select: { id: true, astrologerId: true },
  });
  if (!consultation || consultation.astrologerId !== guard.account.astrologerId) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  return ok({ ticket: makeRelayTicket(consultation.id, guard.user.id) });
}
