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
 * Trigram-indexed name search (3+ chars): contains-match ranked by
 * exact → prefix → population. `limit` clamped 1–25 by the caller.
 */
export async function searchGeoPlaces(q: string, limit: number): Promise<Place[]> {
  const lq = escapeLike(q.trim().toLowerCase());
  const rows = await db.$queryRawUnsafe<GeoPlaceRow[]>(
    `SELECT "geonameId","name","countryName","countryCode","admin1Name","admin2Name","latitude","longitude","timezone","population"
     FROM "GeoPlace"
     WHERE "searchText" LIKE '%' || $1 || '%'
     ORDER BY (lower("name") = $2) DESC,
              (lower("name") LIKE $2 || '%') DESC,
              "population" DESC
     LIMIT ${Math.min(limit, 25)}`,
    lq,
    q.trim().toLowerCase(),
  );
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
