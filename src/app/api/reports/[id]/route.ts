import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { CHART_REPORT_TYPES, buildAndPersist, serializeReport } from "../_lib/builder";

/**
 * GET /api/reports/[id] — the user's own report. If it is still "generating"
 * and older than 3.5s, the content is built NOW server-side and persisted as
 * "ready" (plus a "Report ready" notification). This is a fast server build
 * of plain-language sections — not a real PDF job.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;
  const { id } = await ctx.params;

  let report = await db.report.findFirst({ where: { id, userId: auth.user.id } });
  if (!report) return fail(404, "not_found", "Report not found.");

  if (
    report.status === "generating" &&
    CHART_REPORT_TYPES.has(report.type) &&
    Date.now() - report.createdAt.getTime() > 3500
  ) {
    report = await buildAndPersist(report);
  }

  const profile = report.profileId
    ? await db.birthProfile.findUnique({
        where: { id: report.profileId },
        select: { name: true },
      })
    : null;

  return ok({ report: serializeReport(report, { includeSections: true, profileName: profile?.name ?? null }) });
}
