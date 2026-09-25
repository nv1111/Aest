import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { resolveProfileInput, provider } from "@/lib/astrology/server";
import { cached } from "@/lib/cache";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const params = req.nextUrl.searchParams;
  const date = params.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!dateSchema.safeParse(date).success) {
    return fail(422, "bad_date", "Date must be YYYY-MM-DD.");
  }

  const profileId = params.get("profileId");
  let location = {
    name: "New Delhi, India",
    latitude: 28.6139,
    longitude: 77.209,
    timezone: "Asia/Kolkata",
  };

  if (profileId) {
    const resolved = await resolveProfileInput(auth.user.id, profileId);
    if (!resolved) return fail(404, "no_profile", "Birth profile not found.");
    location = {
      name: resolved.profile.placeName,
      latitude: resolved.profile.latitude,
      longitude: resolved.profile.longitude,
      timezone: resolved.profile.timezone,
    };
  } else {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const tz = params.get("tz");
    const name = params.get("name");
    if (Number.isFinite(lat) && Number.isFinite(lng) && tz) {
      location = { name: name ?? "Selected location", latitude: lat, longitude: lng, timezone: tz };
    }
  }

  const panchang = await cached(
    `panchang:${date}:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`,
    12 * 3600000,
    () => provider().getPanchang(date, location)
  );
  return ok(panchang);
}
