import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";
import { serializeReport } from "./_lib/builder";

/**
 * GET /api/reports?limit= — the user's reports, newest first.
 * Home fetches ?limit=1 and reads .reports[0].id / .title / .status — keep
 * this exact response shape: { reports: [...] }.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const raw = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 20;

  const reports = await db.report.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok({ reports: reports.map((r) => serializeReport(r, { includeSections: false })) });
}
