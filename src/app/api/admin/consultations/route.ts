import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requirePersona, isAuthFailure } from "@/lib/api";
import { adminConsultationDTO } from "../_dto";

/**
 * GET /api/admin/consultations?status=active|ended|cancelled|requested
 * (filter optional — none = ALL users' consultations), newest first, limit 100.
 *
 * `refundedAmount` per consultation = Σ WalletTransaction(type "refund",
 * referenceId = consultation.id), computed for ALL listed rows in ONE groupBy
 * (the pooler makes per-row lookups an N+1 × 250-450 ms problem).
 */
const CONSULTATION_STATUSES = new Set(["active", "ended", "cancelled", "requested"]);

export async function GET(req: NextRequest) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  // empty string ("?status=") counts as no filter
  const status = req.nextUrl.searchParams.get("status") || null;
  if (status != null && !CONSULTATION_STATUSES.has(status)) {
    return fail(422, "validation_failed", "Unknown consultation status filter.");
  }

  const consultations = await db.consultation.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, phone: true } },
      astrologer: { select: { id: true, displayName: true } },
    },
  });

  const ids = consultations.map((c) => c.id);
  const refundRows = ids.length
    ? await db.walletTransaction.groupBy({
        by: ["referenceId"],
        where: { type: "refund", referenceId: { in: ids } },
        _sum: { amount: true },
      })
    : [];

  const refundedById = new Map(
    refundRows.map((r) => [r.referenceId ?? "", r._sum.amount ?? 0])
  );

  return ok({
    consultations: consultations.map((c) =>
      adminConsultationDTO(c, refundedById.get(c.id) ?? 0)
    ),
  });
}
