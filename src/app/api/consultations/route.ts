import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";
import { consultationDTO } from "./_shared";

/**
 * GET /api/consultations?limit=&status=
 * → { consultations: ConsultationDTO[] } — the user's own, newest first.
 *
 * CONTRACT: Home fetches `?limit=1` and reads
 * `.consultations[0].astrologer.displayName` and `.totalAmount` — keep this
 * shape exactly.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const params = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 20) || 20, 1), 50);
  const status = params.get("status");

  const consultations = await db.consultation.findMany({
    where: {
      userId: auth.user.id,
      ...(status ? { status } : {}),
    },
    include: { astrologer: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok({ consultations: consultations.map(consultationDTO) });
}
