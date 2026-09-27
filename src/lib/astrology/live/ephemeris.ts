/**
 * LIVE ENGINE — Core ephemeris mathematics.
 *
 * Planetary positions: astronomy-engine (VSOP87-grade, MIT license) — apparent
 * geocentric longitudes in the true ecliptic of date (light-time + aberration +
 * nutation included), converted to the sidereal zodiac via the Lahiri
 * (Chitrapaksha) ayanamsa.
 *
 * Lunar nodes: mean node (the standard used in Vedic astrology).
 *
 * All functions are pure and deterministic; the API routes cache results.
 */

import * as Astronomy from "astronomy-engine";
import type { PlanetName } from "../types";

const DEG = Math.PI / 180;
const DAY_MS = 86400000;

export function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Julian day from a JS Date. */
export function julianDay(d: Date): number {
  return d.getTime() / DAY_MS + 2440587.5;
}

// ---------------------------------------------------------------- ayanamsa

/**
 * Lahiri (Chitrapaksha) ayanamsa — polynomial fit around J2000.
 * Reference points: J2000 = 23.853057° (23°51'11"), drift ≈ 50.29"/year.
 * Valid for ~1900–2100 with error under ~5 arc-seconds.
 */
export function ayanamsa(d: Date): number {
  const T = (julianDay(d) - 2451545.0) / 36525; // Julian centuries since J2000
  return 23.853057 + 1.396042 * T + 0.0003086 * T * T;
}

// ---------------------------------------------------------------- positions

const BODY: Partial<Record<PlanetName, Astronomy.Body>> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
};

/**
 * Apparent geocentric TROPICAL longitude in the true ecliptic of date.
 * Nodes use the standard mean-node motion (Vedic convention).
 */
export function tropicalLongitude(planet: PlanetName, date: Date): number {
  if (planet === "Rahu" || planet === "Ketu") {
    const d = julianDay(date) - 2451545.0;
    const node = norm360(125.04452 - 0.05295376 * d);
    return norm360(node + (planet === "Ketu" ? 180 : 0));
  }
  const t = Astronomy.MakeTime(date);
  const eqj = Astronomy.GeoVector(BODY[planet]!, t, true); // apparent: light-time + aberration
  const rot = Astronomy.Rotation_EQJ_ECT(t); // J2000 equator → true ecliptic of date
  const v = Astronomy.RotateVector(rot, eqj);
  return norm360(Math.atan2(v.y, v.x) / DEG);
}

/** Sidereal (Lahiri) longitude — the Vedic zodiac position. */
export function siderealLongitude(planet: PlanetName, date: Date): number {
  return norm360(tropicalLongitude(planet, date) - ayanamsa(date));
}

/** Daily sidereal motion in degrees (signed; negative = retrograde). */
export function dailyMotion(planet: PlanetName, date: Date): number {
  const h12 = DAY_MS / 2;
  const before = siderealLongitude(planet, new Date(date.getTime() - h12));
  const after = siderealLongitude(planet, new Date(date.getTime() + h12));
  let diff = norm360(after - before);
  if (diff > 180) diff -= 360;
  return diff;
}

/** Retrograde from actual longitude motion (nodes always retrograde by definition). */
export function isRetrograde(planet: PlanetName, date: Date): boolean {
  if (planet === "Rahu" || planet === "Ketu") return true;
  if (planet === "Sun" || planet === "Moon") return false;
  return dailyMotion(planet, date) < 0;
}

// ---------------------------------------------------------------- ascendant

/** Greenwich mean sidereal time in degrees. */
export function gmstDegrees(date: Date): number {
  return norm360(Astronomy.SiderealTime(date) * 15);
}

/**
 * TROPICAL ascendant (Lagna) ecliptic longitude.
 * Standard oblique-sphere formula: with θ = RAMC (= local sidereal time),
 * ε = obliquity, φ = latitude:
 *   ASC = atan2( cos θ, −( sin θ·cos ε + tan φ·sin ε ) )
 */
export function tropicalAscendant(date: Date, latitude: number, longitudeDeg: number): number {
  const theta = norm360(gmstDegrees(date) + longitudeDeg); // local sidereal time (east positive)
  const T = (julianDay(date) - 2451545.0) / 36525;
  const eps = (23.4392911 - 0.0130042 * T) * DEG; // mean obliquity of date
  const lat = latitude * DEG;
  const asc =
    Math.atan2(Math.cos(theta * DEG), -(Math.sin(theta * DEG) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))) / DEG;
  return norm360(asc);
}

/** SIDEREAL ascendant longitude (Lahiri). */
export function ascendantLongitude(date: Date, latitude: number, longitudeDeg: number): number {
  return norm360(tropicalAscendant(date, latitude, longitudeDeg) - ayanamsa(date));
}

// ---------------------------------------------------------------- rise/set

export interface SolarEvents {
  sunriseUTC: Date;
  sunsetUTC: Date;
  solarNoonUTC: Date;
}

/**
 * Sunrise / sunset / solar noon for a location and local date.
 * Uses astronomy-engine's horizon (includes refraction); solar noon is the
 * midpoint of rise and set (symmetric around transit to within seconds).
 * NOTE: rise is searched from local midnight, set from local noon — so the
 * events always belong to the requested local date.
 */
export function solarEvents(
  dateStr: string,
  latitude: number,
  longitudeDeg: number,
  timezone: string
): SolarEvents {
  const localMidnight = localToUTC(dateStr, "00:00", timezone);
  const localNoon = localToUTC(dateStr, "12:00", timezone);
  const observer = new Astronomy.Observer(latitude, longitudeDeg, 0);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, 1, Astronomy.MakeTime(localMidnight), 1.2);
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, Astronomy.MakeTime(localNoon), 1.2);
  if (!rise || !set) {
    // polar edge case — fall back to a nominal 06:00/18:00 local
    const sunrise = localMidnight;
    const sunset = localToUTC(dateStr, "18:00", timezone);
    return { sunriseUTC: sunrise, sunsetUTC: sunset, solarNoonUTC: new Date((sunrise.getTime() + sunset.getTime()) / 2) };
  }
  return {
    sunriseUTC: rise.date,
    sunsetUTC: set.date,
    solarNoonUTC: new Date((rise.date.getTime() + set.date.getTime()) / 2),
  };
}

/** Moonrise / moonset for the local date (null when the event does not occur). */
export function lunarEvents(
  dateStr: string,
  latitude: number,
  longitudeDeg: number,
  timezone: string
): { moonriseUTC: Date | null; moonsetUTC: Date | null } {
  const localMidnight = localToUTC(dateStr, "00:00", timezone);
  const observer = new Astronomy.Observer(latitude, longitudeDeg, 0);
  const t0 = Astronomy.MakeTime(localMidnight);
  const rise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, 1, t0, 1.2);
  const set = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, t0, 1.2);
  return { moonriseUTC: rise?.date ?? null, moonsetUTC: set?.date ?? null };
}

// ---------------------------------------------------------------- time utils
// (same contracts as the mock engine's utils — shared by both providers)

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

export function houseFromSign(planetSignIndex: number, ascSignIndex: number): number {
  return ((planetSignIndex - ascSignIndex + 12) % 12) + 1;
}

// ---------------------------------------------------------------- searching

const SEARCH_STEP_DAYS: Record<PlanetName, number> = {
  Sun: 1, Moon: 1, Mercury: 2, Venus: 2, Mars: 3,
  Jupiter: 15, Saturn: 30, Rahu: 30, Ketu: 30,
};

const SEARCH_MAX_DAYS: Record<PlanetName, number> = {
  Sun: 45, Moon: 4, Mercury: 100, Venus: 100, Mars: 200,
  Jupiter: 550, Saturn: 1300, Rahu: 750, Ketu: 750,
};

/**
 * Find the moment the planet crossed INTO its current sidereal sign
 * (searching backwards from `asOf`), and when it will LEAVE (forward).
 * Handles retrograde re-entries naturally: the first boundary crossing
 * in each direction wins.
 */
export function signEntryTimes(
  planet: PlanetName,
  asOf: Date
): { enteredOn: Date; leavesOn: Date } {
  const currentSign = Math.floor(siderealLongitude(planet, asOf) / 30);
  const step = SEARCH_STEP_DAYS[planet] * DAY_MS;
  const maxDays = SEARCH_MAX_DAYS[planet] * DAY_MS;

  const crossed = (d: Date): boolean =>
    Math.floor(siderealLongitude(planet, d) / 30) !== currentSign;

  const bisect = (inSign: Date, outSign: Date): Date => {
    let lo = inSign, hi = outSign;
    for (let i = 0; i < 24; i++) {
      const mid = new Date((lo.getTime() + hi.getTime()) / 2);
      if (crossed(mid)) hi = mid;
      else lo = mid;
    }
    return hi; // first moment outside → the boundary
  };

  // backwards: last moment the planet was in a different sign
  let prev = asOf;
  let back = new Date(asOf.getTime() - step);
  while (back.getTime() > asOf.getTime() - maxDays && !crossed(back)) {
    prev = back;
    back = new Date(back.getTime() - step);
  }
  if (!crossed(back)) back = new Date(asOf.getTime() - maxDays); // fallback clamp
  const enteredOn = crossed(back) ? bisect(prev, back) : back;

  // forwards: first moment the planet leaves this sign
  let next = asOf;
  let fwd = new Date(asOf.getTime() + step);
  while (fwd.getTime() < asOf.getTime() + maxDays && !crossed(fwd)) {
    next = fwd;
    fwd = new Date(fwd.getTime() + step);
  }
  if (!crossed(fwd)) fwd = new Date(asOf.getTime() + maxDays); // fallback clamp
  const leavesOn = crossed(fwd) ? bisect(next, fwd) : fwd;

  return { enteredOn, leavesOn };
}

// ---------------------------------------------------------------- validation

/**
 * Internal consistency anchors: apparent Sun longitude at the 2026 March
 * equinox instant (14:46 UTC) must be ~0.0003°, and at the June solstice
 * (08:25 UTC) ~90.0000°. Used by validate.ts.
 */
export const EQUINOX_ANCHORS = {
  marchEquinox: { date: new Date("2026-03-20T14:46:00Z"), expected: 0, toleranceDeg: 0.01 },
  juneSolstice: { date: new Date("2026-06-21T08:25:00Z"), expected: 90, toleranceDeg: 0.01 },
};
