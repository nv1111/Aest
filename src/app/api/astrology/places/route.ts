import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { searchPlaces } from "@/lib/cities";
import { searchGeoPlaces } from "@/lib/geo/places";

/**
 * GET /api/astrology/places?q=… — birth-place search over self-hosted
 * GeoNames (Phase 1.5): India full (villages/towns/cities) + every world
 * place with population ≥ 500. Trigram GIN fast-path for 3+ chars;
 * 2-char queries use the instant static prefix list. Falls back to the
 * static list if the DB layer fails, so onboarding never dead-ends.
 */

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 12, 1), 25);

  if (q.length < 3) {
    // Empty/short query: instant static list (popular defaults or prefix).
    return ok({ places: searchPlaces(q, limit) });
  }

  try {
    const places = await searchGeoPlaces(q, limit);
    return ok({ places });
  } catch (err) {
    console.error("[places] GeoPlace search failed, static fallback:", err);
    const fallback = searchPlaces(q, limit);
    if (fallback.length > 0) return ok({ places: fallback });
    return fail(503, "search_failed", "Place search is unavailable right now. Please try again.");
  }
}
