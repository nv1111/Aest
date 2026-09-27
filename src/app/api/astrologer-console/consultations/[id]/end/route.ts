import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { settleConsultation } from "@/app/api/consultations/_shared";
import {
  requireConsoleAstrologer,
  isGuardFailure,
  consoleConsultationDTO,
  consoleConsultationInclude,
} from "../../../_shared";

/**
 * POST /api/astrologer-console/consultations/[id]/end
 *
 * Ownership + status "active" (409 otherwise). Delegates to the SHARED
 * settleConsultation() (the exact same billing path as the user-side end
 * route): wallet debit with cap-at-balance, minutes calc, LLM summary with an
 * 8s ceiling, notification to the consultation's USER, consultation:ended +
 * consultation:status "ended" relays. Concurrent user+console ends settle
 * exactly once (atomic status flip inside the transaction).
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
  if (consultation.status !== "active") {
    return fail(
      409,
      "consultation_not_active",
      "Only an active consultation can be ended."
    );
  }

  const settled = await settleConsultation(id);
  if (!settled) {
    return fail(409, "consultation_ended", "This consultation has already ended.");
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
