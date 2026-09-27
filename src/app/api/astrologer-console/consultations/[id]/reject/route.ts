import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { declineConsultation } from "@/app/api/consultations/_shared";
import {
  requireConsoleAstrologer,
  isGuardFailure,
  consoleConsultationDTO,
  consoleConsultationInclude,
} from "../../../_shared";

/**
 * POST /api/astrologer-console/consultations/[id]/reject
 *
 * Ownership + still "requested" (409 otherwise). Delegates to the shared
 * declineConsultation(): status → cancelled, "not charged" notification to
 * the USER, consultation:status "cancelled" relay.
 * → { consultation: ConsoleConsultationDTO }
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const { id } = await params;
  const consultation = await db.consultation.findUnique({
    where: { id },
    select: { id: true, astrologerId: true, status: true },
  });
  if (!consultation || consultation.astrologerId !== guard.account.astrologerId) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }
  if (consultation.status !== "requested") {
    return fail(
      409,
      "not_requested",
      "This consultation is no longer waiting for acceptance."
    );
  }

  const declined = await declineConsultation(id);
  if (!declined) {
    return fail(
      409,
      "not_requested",
      "This consultation is no longer waiting for acceptance."
    );
  }

  const row = await db.consultation.findUnique({
    where: { id },
    include: consoleConsultationInclude,
  });
  if (!row) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  return ok({ consultation: consoleConsultationDTO(row) });
}
