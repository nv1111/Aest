import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { acceptConsultation } from "@/app/api/consultations/_shared";
import {
  requireConsoleAstrologer,
  isGuardFailure,
  consoleConsultationDTO,
  consoleConsultationInclude,
} from "../../../_shared";

/**
 * POST /api/astrologer-console/consultations/[id]/accept
 *
 * Ownership: the consultation must belong to the operated astrologer (404
 * otherwise) and still be in the "requested" state (409 otherwise — already
 * accepted/declined/ended). Delegates to the shared acceptConsultation():
 * status → active, greeting + billing system messages, USER notification,
 * astrologer consultationCount+1, room relays.
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

  const accepted = await acceptConsultation(id);
  if (!accepted) {
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
