import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requirePersona, isAuthFailure } from "@/lib/api";
import { adminAstrologerDTO } from "../_dto";

/**
 * GET /api/admin/astrologers → { astrologers: AdminAstrologerDTO[] }
 *
 * ALL astrologers for the KYC table. Sort (in JS, after a single fetch):
 * pending FIRST → approved → rejected → suspended; within the same status by
 * name so the table order is deterministic.
 * `operatedByConsole` = an AstrologerAccount row exists for that astrologerId
 * (a role-switch demo persona is currently operating the profile).
 */
const KYC_RANK: Record<string, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  suspended: 3,
};

function kycRank(s: string): number {
  return KYC_RANK[s] ?? 4;
}

export async function GET(_req: NextRequest) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  const [astrologers, accounts] = await Promise.all([
    db.astrologer.findMany({ orderBy: { createdAt: "asc" } }),
    db.astrologerAccount.findMany({ select: { astrologerId: true } }),
  ]);

  const operated = new Set(accounts.map((a) => a.astrologerId));

  const sorted = [...astrologers].sort(
    (a, b) =>
      kycRank(a.kycStatus) - kycRank(b.kycStatus) ||
      a.displayName.localeCompare(b.displayName)
  );

  return ok({
    astrologers: sorted.map((a) => adminAstrologerDTO(a, operated.has(a.id))),
  });
}
