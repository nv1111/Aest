/**
 * Shared GeoPlace helpers (Phase 1.5 — self-hosted GeoNames geocoding).
 * Server-side only; used by /api/astrology/places and /places/near.
 */

import { db } from "@/lib/db";
import type { Place } from "@/lib/cities";

export interface GeoPlaceRow {
  geonameId: number;
  name: string;
  countryName: string | null;
  countryCode: string;
  admin1Name: string | null;
  admin2Name: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number;
}

export function toPlace(r: GeoPlaceRow): Place {
  return {
    name: r.name,
    country: r.countryName ?? r.countryCode,
    admin: [r.admin2Name, r.admin1Name].filter(Boolean).join(", ") || undefined,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  };
}

/** Escape LIKE wildcards inside the user's query. */
export const escapeLike = (s: string): string => s.replace(/([%_\\])/g, "\\$1");

/**
 * Trigram-indexed name search (3+ chars): ranked exact → prefix →
 * population. `limit` clamped 1–25 by the caller.
 *
 * Three match strategies:
 * 1. SHORT LATIN (≤4 chars, ASCII): two-phase query over the covering index
 *    `geoplace_search_prefix` (searchText btree, INCLUDE population+id):
 *    inner = Index-Only Scan of the [needle, successor) key range +
 *    in-memory top-N by population (Heap Fetches: 0); outer fetches the top
 *    rows by PK. searchText starts with lower(name), so the range = name
 *    prefix; the en_US.UTF-8 collation also matches diacritics (Rām… for
 *    "ram"). The GIN contains-path measured 2.7–4.5 s on cold 3-char
 *    queries; this stays ~150 ms cold.
 * 2. SHORT DEVANAGARI (≤4 chars): GIN prefix 'पट%' OR token '% पट%' —
 *    Hindi alt names live mid-searchText, so a name-prefix alone never
 *    reaches them; Devanagari posting lists are tiny → fast.
 * 3. 5+ CHARS: GIN contains on searchText (full surface incl. Hindi).
 */
export async function searchGeoPlaces(q: string, limit: number): Promise<Place[]> {
  const needle = q.trim().toLowerCase();
  const lq = escapeLike(needle);
  const isShort = lq.length <= 4;
  const isAscii = !/[^\x00-\x7f]/.test(lq);
  const capped = Math.min(Math.max(limit, 1), 25);

  let sql: string;
  let params: unknown[];

  if (isShort && isAscii) {
    // Lexicographic successor of the needle ("ram" → "ran"); the open-closed
    // range [needle, next) captures exactly the searchText prefix matches.
    const next = needle.slice(0, -1) + String.fromCharCode(needle.charCodeAt(needle.length - 1) + 1);
    sql = `SELECT "geonameId","name","countryName","countryCode","admin1Name","admin2Name","latitude","longitude","timezone","population"
     FROM "GeoPlace"
     WHERE "geonameId" IN (
       SELECT "geonameId" FROM "GeoPlace"
       WHERE "searchText" >= $1 AND "searchText" < $2
       ORDER BY "population" DESC
       LIMIT ${capped}
     )
     ORDER BY "population" DESC`;
    params = [needle, next];
  } else if (isShort) {
    sql = `SELECT "geonameId","name","countryName","countryCode","admin1Name","admin2Name","latitude","longitude","timezone","population"
     FROM "GeoPlace"
     WHERE "searchText" LIKE $1 OR "searchText" LIKE $3
     ORDER BY (lower("name") = $2) DESC,
              (lower("name") LIKE $2 || '%') DESC,
              "population" DESC
     LIMIT ${capped}`;
    params = [`${lq}%`, needle, `% ${lq}%`];
  } else {
    sql = `SELECT "geonameId","name","countryName","countryCode","admin1Name","admin2Name","latitude","longitude","timezone","population"
     FROM "GeoPlace"
     WHERE "searchText" LIKE $1
     ORDER BY (lower("name") = $2) DESC,
              (lower("name") LIKE $2 || '%') DESC,
              "population" DESC
     LIMIT ${capped}`;
    params = [`%${lq}%`, needle];
  }

  const rows = await db.$queryRawUnsafe<GeoPlaceRow[]>(sql, ...params);
  return rows.map(toPlace);
}

export interface NearPlace extends Place {
  distanceKm: number;
}

/**
 * Nearest known place to a coordinate (map pin). Bounding-box prefilter
 * + exact haversine. Returns null when nothing is within `box` degrees
 * (~111 km per degree) — caller retries with a wider box.
 */
export async function nearestGeoPlace(lat: number, lng: number, box: number): Promise<NearPlace | null> {
  // Widen the longitude box at high latitudes (cos → 0), clamped.
  const lngBox = Math.max(box, box / Math.max(0.25, Math.cos((lat * Math.PI) / 180)));
  const rows = await db.$queryRawUnsafe<
    (GeoPlaceRow & { distKm: number })[]
  >(
    `SELECT "geonameId","name","countryName","countryCode","admin1Name","admin2Name","latitude","longitude","timezone","population",
            (6371 * acos(least(1, greatest(-1,
              sin(radians($3)) * sin(radians("latitude")) +
              cos(radians($3)) * cos(radians("latitude")) * cos(radians("longitude" - $4))
            )))) AS "distKm"
     FROM "GeoPlace"
     WHERE "latitude" BETWEEN $1 AND $2
       AND "longitude" BETWEEN $5 AND $6
     ORDER BY "distKm" ASC
     LIMIT 1`,
    lat - box,
    lat + box,
    lat,
    lng,
    lng - lngBox,
    lng + lngBox,
  );
  const row = rows[0];
  if (!row) return null;
  return { ...toPlace(row), distanceKm: Math.round(row.distKm * 10) / 10 };
}
