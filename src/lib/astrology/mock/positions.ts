/**
 * MOCK ENGINE — deterministic planetary positions & solar events.
 *
 * IMPORTANT: This is DEMO data. Mean-longitude approximations + Lahiri-style
 * ayanamsa produce plausible, stable values — they are NOT precise ephemeris
 * calculations and must never be presented as such. See AGENTS.md §3.
 *
 * Everything here is a pure function of (input, asOf) so results are stable
 * across requests and cacheable.
 */

import type { PlanetName, TimeAccuracy } from "../types";

// ---------------------------------------------------------------- seeded rng

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- time utils

export function tzOffsetMinutes(utc: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(utc).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUTC - utc.getTime()) / 60000);
  } catch {
    return 330; // fallback: IST
  }
}

/** Convert local wall-clock (date "YYYY-MM-DD", time "HH:mm") in tz → UTC Date. */
export function localToUTC(dateStr: string, timeStr: string | null, tz: string): Date {
  const time = timeStr ?? "12:00";
  const naive = new Date(`${dateStr}T${time}:00.000Z`); // treat as UTC first
  const offset = tzOffsetMinutes(naive, tz);
  return new Date(naive.getTime() - offset * 60000);
}

/** Local wall clock "HH:mm" for a UTC instant in a timezone. */
export function toLocalHHMM(utc: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utc);
  } catch {
    return "--:--";
  }
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------- astronomy

const DAY_MS = 86400000;

/** Julian day from a JS Date. */
export function julianDay(d: Date): number {
  return d.getTime() / DAY_MS + 2440587.5;
}

export function fromJulianDay(jd: number): Date {
  return new Date((jd - 2440587.5) * DAY_MS);
}

/** Lahiri-style ayanamsa, slowly increasing over years. */
export function ayanamsa(d: Date): number {
  const year = 2000 + (julianDay(d) - 2451545.0) / 365.25;
  return 23.85 + (year - 2000) * 0.013966;
}

/** Tropical mean longitudes at J2000 epoch + daily motion (demo approximation). */
const MEAN_ELEMENTS: { planet: PlanetName; l0: number; perDay: number; alwaysRetro?: boolean }[] = [
  { planet: "Sun", l0: 280.46, perDay: 0.9856474 },
  { planet: "Moon", l0: 218.316, perDay: 13.176396 },
  { planet: "Mercury", l0: 252.251, perDay: 4.09233445 },
  { planet: "Venus", l0: 181.98, perDay: 1.60216857 },
  { planet: "Mars", l0: 355.433, perDay: 0.524020776 },
  { planet: "Jupiter", l0: 34.351, perDay: 0.08308529 },
  { planet: "Saturn", l0: 50.077, perDay: 0.033444228 },
  { planet: "Rahu", l0: 125.044, perDay: -0.0529539, alwaysRetro: true },
];

export function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Sidereal (approx) longitude of a planet at a moment. Ketu = Rahu + 180. */
export function siderealLongitude(planet: PlanetName, at: Date): number {
  const d = julianDay(at) - 2451545.0;
  if (planet === "Ketu") {
    const rahu = MEAN_ELEMENTS.find((e) => e.planet === "Rahu")!;
    return norm360(norm360(rahu.l0 + rahu.perDay * d) - ayanamsa(at) + 180);
  }
  const el = MEAN_ELEMENTS.find((e) => e.planet === planet)!;
  return norm360(norm360(el.l0 + el.perDay * d) - ayanamsa(at));
}

/**
 * Retrograde flags: nodes always retro; inner planets retrograde during
 * plausible deterministic windows of their synodic cycles (demo approximation).
 */
export function isRetrograde(planet: PlanetName, at: Date): boolean {
  if (planet === "Rahu" || planet === "Ketu") return true;
  if (planet === "Sun" || planet === "Moon") return false;
  const synodic: Record<string, { period: number; window: number }> = {
    Mercury: { period: 115.88, window: 21 },
    Venus: { period: 583.92, window: 41 },
    Mars: { period: 779.94, window: 68 },
    Jupiter: { period: 398.88, window: 120 },
    Saturn: { period: 378.09, window: 137 },
  };
  const cfg = synodic[planet];
  if (!cfg) return false;
  const d = julianDay(at) - 2451545.0;
  const phase = ((d % cfg.period) + cfg.period) % cfg.period;
  return phase > cfg.period - cfg.window;
}

// ---------------------------------------------------------------- ascendant

/**
 * Approximate ascendant from local sidereal time + latitude.
 * MC ≈ local sidereal time; ascendant ≈ MC + 90° adjusted toward the equator
 * with latitude. Demo-grade, deterministic.
 */
export function ascendantLongitude(birthUTC: Date, latitude: number, longitudeDeg: number, tz: string): number {
  const jd = julianDay(birthUTC);
  const d = jd - 2451545.0;
  const utHours =
    (birthUTC.getTime() / DAY_MS) % 1; // fraction of UTC day
  // Greenwich mean sidereal time in degrees
  const gmst = norm360(280.46061837 + 360.98564736629 * d);
  const lst = norm360(gmst + utHours * 360 + longitudeDeg); // local sidereal time
  const mc = lst;
  const obliquity = 23.44;
  // crude but stable: RAMC → asc via oblique-sphere rotation
  const ramcRad = (mc * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;
  const epsRad = (obliquity * Math.PI) / 180;
  let asc = Math.atan2(
    Math.cos(ramcRad),
    -(Math.sin(ramcRad) * Math.cos(epsRad) + Math.tan(latRad) * Math.sin(epsRad))
  );
  asc = norm360((asc * 180) / Math.PI + 180);
  return norm360(asc - ayanamsa(birthUTC));
}

// ---------------------------------------------------------------- sun events

export interface SolarEvents {
  sunriseUTC: Date;
  sunsetUTC: Date;
  solarNoonUTC: Date;
}

const RAD = Math.PI / 180;

/**
 * NOAA-style sunrise/sunset for a local date at a location.
 * Returns null-ish polar edge handled by clamping (demo).
 */
export function solarEvents(dateStr: string, latitude: number, longitudeDeg: number, tz: string): SolarEvents {
  // local noon (12:00) in tz → approximate the date's solar context
  const localNoon = localToUTC(dateStr, "12:00", tz);
  const jdNoon = Math.round(julianDay(localNoon)) + 0.5; // .5 = noon UT? adjust below
  const n = Math.round(julianDay(localNoon) - 2451545.0 + 0.0008);
  const jStar = n - longitudeDeg / 360;
  const M = norm360(357.5291 + 0.98560028 * jStar);
  const C =
    1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = norm360(M + C + 180 + 102.9372);
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDelta = Math.sin(lambda * RAD) * Math.sin(23.44 * RAD);
  const delta = Math.asin(sinDelta) / RAD;
  const latRad = latitude * RAD;
  const cosOmega =
    (Math.sin(-0.833 * RAD) - Math.sin(latRad) * Math.sin(delta * RAD)) /
    (Math.cos(latRad) * Math.cos(delta * RAD));
  const clamped = Math.max(-1, Math.min(1, cosOmega));
  const omega = Math.acos(clamped) / RAD;
  const jRise = jTransit - omega / 360;
  const jSet = jTransit + omega / 360;
  void jdNoon;
  return {
    sunriseUTC: fromJulianDay(jRise),
    sunsetUTC: fromJulianDay(jSet),
    solarNoonUTC: fromJulianDay(jTransit),
  };
}

// ---------------------------------------------------------------- house utils

export function houseFromSign(planetSignIndex: number, ascSignIndex: number): number {
  return ((planetSignIndex - ascSignIndex + 12) % 12) + 1;
}
