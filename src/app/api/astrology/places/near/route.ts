import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { nearestGeoPlace, type NearPlace } from "@/lib/geo/places";

/**
 * GET /api/astrology/places/near?lat=..&lng=..
 * Nearest known GeoPlace to a map-pin / manual coordinate — gives the
 * user a readable label and, more importantly, the IANA timezone for
 * chart computation.
 */

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return fail(400, "bad_coords", "Valid latitude and longitude are required.");
  }

  try {
    const place: NearPlace | null =
      (await nearestGeoPlace(lat, lng, 1)) ?? (await nearestGeoPlace(lat, lng, 5));
    return ok({ place });
  } catch (err) {
    console.error("[places/near] failed:", err);
    return fail(503, "lookup_failed", "Could not look up the nearest place. Please try again.");
  }
}
