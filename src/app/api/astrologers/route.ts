import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";
import { publicAstrologer } from "./_dto";

/**
 * Astrologer marketplace list. Response shape is the contract:
 *   { astrologers: AstrologerDTO[] }
 * Home fetches `?section=online&limit=4` — keep that working.
 *
 * Filters (all optional, AND-combined):
 *   expertise    substring inside the expertise JSON string
 *   language     substring inside the languages JSON string
 *   minPrice / maxPrice  pricePerMinute bounds
 *   minRating    rating ≥
 *   minExperience experienceYears ≥
 *   mode         substring inside consultationModes JSON (chat|audio|video)
 *   q            displayName contains (case-insensitive)
 *   section      online | soon | top | new | recommended
 *   limit        max results (≤ 50)
 *
 * 12 demo rows — filtering in JS after a full fetch keeps this simple and
 * always consistent with the section sort orders.
 */

const STATUS_RANK: Record<string, number> = { online: 0, away: 1, offline: 2 };

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusRank(s: string): number {
  return STATUS_RANK[s] ?? 3;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const params = req.nextUrl.searchParams;
  const section = params.get("section"); // online | soon | top | new | recommended
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 24) || 24, 1), 50);

  const expertise = params.get("expertise");
  const language = params.get("language");
  const minPrice = num(params.get("minPrice"));
  const maxPrice = num(params.get("maxPrice"));
  const minRating = num(params.get("minRating"));
  const minExperience = num(params.get("minExperience"));
  const mode = params.get("mode");
  const q = params.get("q");

  const all = await db.astrologer.findMany({
    orderBy: [{ onlineStatus: "asc" }, { rating: "desc" }, { reviewCount: "desc" }],
  });

  let rows = all;

  // ---------------------------------------------------------- filters (AND)
  if (expertise) rows = rows.filter((a) => a.expertise.toLowerCase().includes(expertise.toLowerCase()));
  if (language) rows = rows.filter((a) => a.languages.toLowerCase().includes(language.toLowerCase()));
  if (minPrice != null) rows = rows.filter((a) => a.pricePerMinute >= minPrice);
  if (maxPrice != null) rows = rows.filter((a) => a.pricePerMinute <= maxPrice);
  if (minRating != null) rows = rows.filter((a) => a.rating >= minRating);
  if (minExperience != null) rows = rows.filter((a) => a.experienceYears >= minExperience);
  if (mode) rows = rows.filter((a) => a.consultationModes.toLowerCase().includes(mode.toLowerCase()));
  if (q) rows = rows.filter((a) => a.displayName.toLowerCase().includes(q.toLowerCase()));

  // ---------------------------------------------------------- sections
  if (section === "online") {
    rows = rows.filter((a) => a.onlineStatus === "online");
  } else if (section === "soon") {
    rows = rows.filter((a) => a.onlineStatus === "away" && a.availableFrom != null);
  } else if (section === "top") {
    rows = [...rows].sort(
      (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount
    );
  } else if (section === "new") {
    // newly verified = lowest consultation count among verified
    rows = rows.filter((a) => a.isVerified).sort((a, b) => a.consultationCount - b.consultationCount);
  } else if (section === "recommended" || section == null) {
    // top-rated online first, then away, then offline
    rows = [...rows].sort(
      (a, b) =>
        statusRank(a.onlineStatus) - statusRank(b.onlineStatus) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount
    );
  }

  return ok({ astrologers: rows.slice(0, limit).map(publicAstrologer) });
}
