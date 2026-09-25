import { NextRequest, NextResponse } from "next/server";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { resolveProfileInput, provider } from "@/lib/astrology/server";
import { cached } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const profileId = req.nextUrl.searchParams.get("profileId");
  const resolved = await resolveProfileInput(auth.user.id, profileId);
  if (!resolved) return fail(404, "no_profile", "Add your birth details first.");

  const { profile, input } = resolved;
  const locale = req.nextUrl.searchParams.get("locale") === "hi" ? "hi" : "en";
  const chart = await cached(
    `chart:${profile.id}:${profile.updatedAt.toISOString()}:${locale}`,
    30 * 86400000,
    () => provider().getBirthChart(input, locale)
  );
  return ok(chart);
}
