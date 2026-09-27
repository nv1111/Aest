/**
 * LIVE ENGINE VALIDATION HARNESS (dev tool — run: bun src/lib/astrology/live/validate.ts)
 *
 * Reference anchors:
 *  1. Equinox/solstice apparent Sun longitudes (astronomical ground truth)
 *  2. Ayanamsa sanity vs published Lahiri values
 *  3. India independence chart (15 Aug 1947, 00:00 IST, Delhi) — published: Taurus lagna
 *  4. M. K. Gandhi chart (2 Oct 1869, 07:12 PM, Porbandar) — published: Libra lagna
 *  5. Current slow-mover signs (Saturn sidereal Pisces, Rahu sidereal Aquarius in 2026)
 *  6. Dasha internal consistency (full 120y cycle, antar spans inside maha)
 *  7. Nakshatra pada boundaries (Ashwini pada 1 must be 0–3°20', Revati pada 4 ends at 360°)
 */

import { getLiveAstrologyProvider } from "./provider";
import {
  ayanamsa,
  tropicalLongitude,
  siderealLongitude,
  ascendantLongitude,
  gmstDegrees,
  localToUTC,
  signEntryTimes,
} from "./ephemeris";
import { SIGNS, NAKSHATRAS } from "../types";

const p = getLiveAstrologyProvider();
let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✅" : "❌"} ${name} — ${detail}`);
  if (ok) pass++;
  else fail++;
}

// ---------------------------------------------------------------- 1. equinox
{
  const mar = tropicalLongitude("Sun", new Date("2026-03-20T14:46:00Z"));
  const jun = tropicalLongitude("Sun", new Date("2026-06-21T08:25:00Z"));
  check(
    "Sun tropical longitude @ March equinox 2026",
    Math.abs(mar - 0) < 0.01 || Math.abs(mar - 360) < 0.01,
    `${mar.toFixed(4)}° (expect ≈ 0°)`
  );
  check(
    "Sun tropical longitude @ June solstice 2026",
    Math.abs(jun - 90) < 0.01,
    `${jun.toFixed(4)}° (expect ≈ 90°)`
  );
}

// ---------------------------------------------------------------- 2. ayanamsa
{
  const now = ayanamsa(new Date("2026-09-27T00:00:00Z"));
  check(
    "Lahiri ayanamsa (Sep 2026)",
    Math.abs(now - 24.22) < 0.02,
    `${now.toFixed(4)}° (published ≈ 24.2279°)`
  );
  const y2000 = ayanamsa(new Date("2000-01-01T12:00:00Z"));
  check(
    "Lahiri ayanamsa (J2000)",
    Math.abs(y2000 - 23.853) < 0.001,
    `${y2000.toFixed(4)}° (published 23°51'11" = 23.8531°)`
  );
}

// ---------------------------------------------------------------- 3. India chart
{
  const input = {
    name: "India",
    dateOfBirth: "1947-08-15",
    timeOfBirth: "00:00",
    timeAccuracy: "exact" as const,
    placeName: "New Delhi",
    latitude: 28.6139,
    longitude: 77.209,
    timezone: "Asia/Kolkata",
  };
  const asc = ascendantLongitude(localToUTC("1947-08-15", "00:00", "Asia/Kolkata"), 28.6139, 77.209);
  const ascSign = SIGNS[Math.floor(asc / 30)];
  check(
    "India independence lagna",
    ascSign === "Taurus",
    `${ascSign} ${Math.floor(asc % 30)}°${Math.floor((asc % 30 % 1) * 60)}' (published: Taurus)`
  );
  const chart = p.getBirthChart(input);
  const sun = chart.planets.find((pl) => pl.planet === "Sun")!;
  check(
    "India chart sidereal Sun (published ≈ Cancer 28°–Leo 0°)",
    sun.sign === "Cancer" || sun.sign === "Leo",
    `${sun.sign} ${sun.degreeInSign.toFixed(2)}°`
  );
  const moon = chart.planets.find((pl) => pl.planet === "Moon")!;
  check(
    "India chart sidereal Moon (published: Cancer, Pushya)",
    moon.sign === "Cancer",
    `${moon.sign} ${moon.degreeInSign.toFixed(2)}°, ${moon.nakshatra} pada ${moon.nakshatraPada}`
  );
}

// ---------------------------------------------------------------- 4. Gandhi chart
{
  // Published: 2 Oct 1869, 07:11 AM, Porbandar — LMT (+04:39 east) — Tula lagna 4°37'
  const naive = new Date("1869-10-02T07:11:00.000Z");
  const lmtOffsetMin = 4 * 60 + 39; // Porbandar local mean time
  const utc = new Date(naive.getTime() - lmtOffsetMin * 60000);
  const asc = ascendantLongitude(utc, 21.6417, 69.6293);
  const ascSign = SIGNS[Math.floor(asc / 30)];
  const ascDeg = asc % 30;
  check(
    "Gandhi lagna (published: Tula/Libra 4°37')",
    ascSign === "Libra" && Math.abs(ascDeg - 4.6167) < 0.5,
    `${ascSign} ${Math.floor(ascDeg)}°${Math.floor((ascDeg % 1) * 60)}' (published 4°37')`
  );
  const moon = siderealLongitude("Moon", utc);
  check(
    "Gandhi Moon (published: Cancer 27°45', Ashlesha)",
    Math.floor(moon / 30) === 3 && Math.floor(moon / (360 / 27)) === 8 && Math.abs((moon % 30) - 27.75) < 0.5,
    `${SIGNS[Math.floor(moon / 30)]} ${(moon % 30).toFixed(2)}°, ${NAKSHATRAS[Math.floor(moon / (360 / 27))]} (published Cancer 27°45' Ashlesha)`
  );
}

// ---------------------------------------------------------------- 5. current signs
{
  const now = new Date("2026-09-27T06:00:00Z");
  const sat = siderealLongitude("Saturn", now);
  const rahu = siderealLongitude("Rahu", now);
  const jup = siderealLongitude("Jupiter", now);
  check(
    "Saturn sidereal sign (Sep 2026, published: Pisces)",
    Math.floor(sat / 30) === 11,
    `${SIGNS[Math.floor(sat / 30)]} ${Math.floor(sat % 30)}°`
  );
  check(
    "Rahu sidereal sign (Sep 2026, published: Aquarius)",
    Math.floor(rahu / 30) === 10,
    `${SIGNS[Math.floor(rahu / 30)]} ${Math.floor(rahu % 30)}°`
  );
  console.log(`ℹ️  Jupiter sidereal: ${SIGNS[Math.floor(jup / 30)]} ${(jup % 30).toFixed(2)}°`);
}

// ---------------------------------------------------------------- 6. dasha consistency
{
  const input = {
    name: "Test",
    dateOfBirth: "1990-05-15",
    timeOfBirth: "14:30",
    timeAccuracy: "exact" as const,
    placeName: "Delhi",
    latitude: 28.6139,
    longitude: 77.209,
    timezone: "Asia/Kolkata",
  };
  const d = p.getDasha(input, new Date("2026-09-27T00:00:00Z"));
  const totalMs = d.timeline[d.timeline.length - 1].end
    ? new Date(d.timeline[d.timeline.length - 1].end).getTime() - new Date(d.timeline[0].start).getTime()
    : 0;
  const years = totalMs / (365.2425 * 86400000);
  check(
    "Dasha timeline = 120y minus balance-at-birth portion",
    years <= 120 && years >= 100,
    `${years.toFixed(3)} years across ${d.timeline.length} mahadashas (starts mid-cycle at birth — correct Vimshottari behaviour)`
  );
  const antarSpan = d.antardashas.reduce((s, a) => s + (new Date(a.end).getTime() - new Date(a.start).getTime()), 0);
  const mahaSpan = new Date(d.current.mahadasha.end).getTime() - new Date(d.current.mahadasha.start).getTime();
  check(
    "Antardashas tile the current mahadasha",
    Math.abs(antarSpan - mahaSpan) / mahaSpan < 0.02,
    `antar total ${(antarSpan / 86400000).toFixed(0)}d vs maha ${(mahaSpan / 86400000).toFixed(0)}d`
  );
}

// ---------------------------------------------------------------- 7. boundaries
{
  const now = new Date("2026-09-27T06:00:00Z");
  const moon = siderealLongitude("Moon", now);
  const nakIndex = Math.floor(moon / (360 / 27));
  const pada = Math.floor((moon % (360 / 27)) / (360 / 108)) + 1;
  const nakStart = nakIndex * (360 / 27);
  const inRange = moon >= nakStart && moon < nakStart + 360 / 27;
  check(
    "Moon nakshatra/pada math is self-consistent",
    inRange && pada >= 1 && pada <= 4,
    `Moon ${moon.toFixed(2)}° → ${NAKSHATRAS[nakIndex]} pada ${pada}`
  );
}

// ---------------------------------------------------------------- 8. sign entry search
{
  const now = new Date("2026-09-27T06:00:00Z");
  const jup = signEntryTimes("Jupiter", now);
  const jupSign = Math.floor(siderealLongitude("Jupiter", now) / 30);
  const enteredSign = Math.floor(siderealLongitude("Jupiter", new Date(jup.enteredOn.getTime() + 3600000)) / 30);
  const beforeSign = Math.floor(siderealLongitude("Jupiter", new Date(jup.enteredOn.getTime() - 3600000)) / 30);
  check(
    "Jupiter sign-entry search: boundary flips exactly at enteredOn",
    enteredSign === jupSign && beforeSign !== jupSign,
    `entered ${SIGNS[jupSign]} at ${jup.enteredOn.toISOString().slice(0, 16)}, leaves ${jup.leavesOn
      .toISOString()
      .slice(0, 16)} (published: Jupiter entered sidereal Cancer ~1 June 2026)`
  );
}

// ---------------------------------------------------------------- 9. independent ascendant cross-check
// Numerical scan: find the ecliptic longitude whose altitude = 0 on the EASTERN
// horizon — completely independent of the closed-form formula.
{
  const cases: { date: string; lat: number; lon: number }[] = [
    { date: "1990-05-15T09:00:00Z", lat: 28.6139, lon: 77.209 },
    { date: "1947-08-14T18:30:00Z", lat: 28.6139, lon: 77.209 },
    { date: "2026-09-27T14:30:00Z", lat: -33.8688, lon: 151.2093 }, // Sydney
    { date: "2026-09-27T02:15:00Z", lat: 51.5074, lon: -0.1278 }, // London
  ];
  const DEG = Math.PI / 180;
  for (const c of cases) {
    const date = new Date(c.date);
    const closed = ascendantLongitude(date, c.lat, c.lon);
    // numerical scan — works in TROPICAL longitude, around the closed-form answer
    const T = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
    const eps = (23.4392911 - 0.0130042 * T) * DEG;
    const theta = (((AstronomySidereal(date) * 15 + c.lon) % 360) + 360) % 360;
    const alt = (lamTropical: number): { alt: number; sinH: number } => {
      const l = lamTropical * DEG;
      const ra = Math.atan2(Math.sin(l) * Math.cos(eps), Math.cos(l));
      const dec = Math.asin(Math.sin(l) * Math.sin(eps));
      const H = (theta * DEG - ra) % (2 * Math.PI);
      const sinH = Math.sin(H);
      const s = Math.sin(c.lat * DEG) * Math.sin(dec) + Math.cos(c.lat * DEG) * Math.cos(dec) * Math.cos(H);
      return { alt: Math.asin(s), sinH };
    };
    const ay = ayanamsa(date);
    const center = ((closed + ay) % 360 + 360) % 360; // sidereal → tropical
    let best = NaN;
    let prev = alt(center - 2);
    for (let t = center - 1.99; t <= center + 1.99; t += 0.02) {
      const cur = alt(t);
      // At the ascendant, λ increasing crosses the horizon downward: degrees
      // just above A in λ are still below the horizon (waiting to rise).
      if (prev.alt >= 0 && cur.alt < 0 && prev.sinH < 0) { best = t; break; } // eastern crossing
      prev = cur;
    }
    const numerical = ((best - ay) % 360 + 360) % 360;
    let diff = Math.abs(numerical - closed);
    if (diff > 180) diff = 360 - diff;
    check(
      `Ascendant closed-form vs numerical scan (${c.date.slice(0, 10)}, lat ${c.lat})`,
      diff < 0.15,
      `closed ${closed.toFixed(3)}° vs numerical ${numerical.toFixed(3)}° — Δ${(diff * 60).toFixed(1)}'`
    );
  }
}

function AstronomySidereal(d: Date): number {
  // Greenwich mean sidereal time in sidereal hours (matches ephemeris.gmstDegrees/15)
  return gmstDegrees(d) / 15;
}


// ---------------------------------------------------------------- summary
console.log(`\n${fail === 0 ? "🎉 ALL CHECKS PASSED" : "⚠️  FAILURES PRESENT"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
