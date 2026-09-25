import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { resolveProfileInput, provider } from "@/lib/astrology/server";
import { cached } from "@/lib/cache";

const schema = z.enum(["daily", "weekly", "monthly", "yearly"]);

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const periodRaw = req.nextUrl.searchParams.get("period") ?? "daily";
  const parsed = schema.safeParse(periodRaw);
  if (!parsed.success) return fail(422, "bad_period", "Period must be daily, weekly, monthly or yearly.");

  const profileId = req.nextUrl.searchParams.get("profileId");
  const resolved = await resolveProfileInput(auth.user.id, profileId);
  if (!resolved) return fail(404, "no_profile", "Add your birth details first.");

  const { profile, input } = resolved;
  const now = new Date();
  const dateKey =
    parsed.data === "daily"
      ? now.toISOString().slice(0, 10)
      : parsed.data === "weekly"
        ? String(Math.ceil((((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7))
        : parsed.data === "monthly"
          ? now.toISOString().slice(0, 7)
          : String(now.getUTCFullYear());

  const horoscope = await cached(
    `horoscope:${profile.id}:${profile.updatedAt.toISOString()}:${parsed.data}:${dateKey}`,
    6 * 3600000,
    () => provider().getHoroscope(input, parsed.data)
  );
  return ok(horoscope);
}
