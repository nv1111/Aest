import { NextRequest } from "next/server";
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
  const dayKey = new Date().toISOString().slice(0, 10);
  const dasha = await cached(
    `dasha:${profile.id}:${profile.updatedAt.toISOString()}:${dayKey}:${locale}`,
    6 * 3600000,
    () => provider().getDasha(input, new Date(), locale)
  );
  return ok(dasha);
}
