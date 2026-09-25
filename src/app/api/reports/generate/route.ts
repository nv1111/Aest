import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { CHART_REPORT_TYPES, REPORT_TITLES, serializeReport } from "../_lib/builder";

const bodySchema = z.object({
  type: z.enum(["kundli", "career", "marriage", "yearly", "compatibility"]),
  profileId: z.string().uuid().optional(),
});

/**
 * POST /api/reports/generate — creates a Report with status "generating".
 * The content itself is built server-side when the report is first read
 * (GET /api/reports/[id]) after a short delay — a deliberate, calm build,
 * not a real PDF job.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  if (!CHART_REPORT_TYPES.has(body.type)) {
    return fail(422, "unsupported_type", "This report type cannot be generated here.");
  }

  let profileId = body.profileId ?? null;
  if (profileId) {
    const owned = await db.birthProfile.findFirst({
      where: { id: profileId, userId: auth.user.id },
    });
    if (!owned) return fail(404, "not_found", "Birth profile not found.");
  } else {
    const primary = await db.birthProfile.findFirst({
      where: { userId: auth.user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    if (!primary) {
      return fail(400, "no_profile", "Add a birth profile first — reports are built from your chart.");
    }
    profileId = primary.id;
  }

  const report = await db.report.create({
    data: {
      userId: auth.user.id,
      profileId,
      type: body.type,
      title: REPORT_TITLES[body.type] ?? "Report",
      status: "generating",
    },
  });

  return ok({ report: serializeReport(report, { includeSections: false }) });
}
