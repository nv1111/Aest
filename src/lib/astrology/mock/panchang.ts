/**
 * MOCK ENGINE — Panchang, Rahu Kaal family, Choghadiya.
 * Sunrise/sunset from the NOAA-style formulas in positions.ts; tithi/nakshatra
 * from approximate Moon/Sun elongation. Demo-grade, deterministic.
 */

import {
  NAKSHATRAS,
  type ChoghadiyaName,
  type ChoghadiyaSlot,
  type PanchangData,
  type PlanetName,
  type TimeRange,
} from "../types";
import {
  addMinutes,
  hhmmToMinutes,
  localToUTC,
  siderealLongitude,
  solarEvents,
  toLocalHHMM,
  norm360,
} from "./positions";

const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
  "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
  "Trayodashi", "Chaturdashi",
];

const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
  "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
  "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha",
  "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
];

const KARANA_CYCLE = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
const KARANA_FIXED_END = ["Shakuni", "Chatushpada", "Naga"];
const KARANA_FIRST = "Kimstughna";

const VARA_LORDS: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const VARA_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// 1-indexed part of daytime (8 parts) by weekday 0=Sunday
const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
const YAMAGANDA_PART = [5, 4, 3, 2, 1, 7, 6];
const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];

// Choghadiya: name cycle + start index per weekday
const CHOGHADIYA_NAMES: ChoghadiyaName[] = ["Udveg", "Chal", "Labh", "Amrit", "Kaag", "Shubh", "Rog"];
const CHOGHADIYA_DAY_START = [0, 3, 6, 2, 5, 1, 4]; // Sun..Sat
const CHOGHADIYA_QUALITY: Record<ChoghadiyaName, "good" | "neutral" | "avoid"> = {
  Amrit: "good",
  Labh: "good",
  Shubh: "good",
  Chal: "neutral",
  Udveg: "avoid",
  Kaag: "avoid",
  Rog: "avoid",
};

const CHOGHADIYA_MEANING: Record<ChoghadiyaName, string> = {
  Amrit: "Best time — things tend to go smoothly",
  Shubh: "Good time for auspicious work",
  Labh: "Good time for gains and trade",
  Chal: "Neutral time — ordinary activities",
  Udveg: "Avoid starting important work",
  Kaag: "Avoid — traditionally inauspicious",
  Rog: "Avoid — traditionally inauspicious",
};

export function choghadiyaMeaning(name: ChoghadiyaName): string {
  return CHOGHADIYA_MEANING[name];
}

function part(range: TimeRange, index1: number): TimeRange {
  const total = hhmmToMinutes(range.end) - hhmmToMinutes(range.start);
  const slice = total / 8;
  const start = hhmmToMinutes(range.start) + slice * (index1 - 1);
  return {
    start: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(Math.round(start % 60)).padStart(2, "0")}`,
    end: `${String(Math.floor((start + slice) / 60)).padStart(2, "0")}:${String(Math.round((start + slice) % 60)).padStart(2, "0")}`,
  };
}

export function buildPanchang(
  dateStr: string,
  location: { name: string; latitude: number; longitude: number; timezone: string },
  provider: PanchangData["provider"]
): PanchangData {
  const { latitude, longitude, timezone } = location;
  const events = solarEvents(dateStr, latitude, longitude, timezone);
  const sunrise = toLocalHHMM(events.sunriseUTC, timezone);
  const sunset = toLocalHHMM(events.sunsetUTC, timezone);
  const solarNoon = toLocalHHMM(events.solarNoonUTC, timezone);

  const dayStart = localToUTC(dateStr, "12:00", timezone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(dayStart);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);

  // Moon / Sun state at mid-day (demo approximation)
  const moon = siderealLongitude("Moon", dayStart);
  const sun = siderealLongitude("Sun", dayStart);
  const elong = norm360(moon - sun);

  // Tithi
  const tithiIndex = Math.floor(elong / 12); // 0..29
  const isShukla = tithiIndex < 15;
  const within = tithiIndex % 15;
  const tithiName =
    within === 14 ? (isShukla ? "Purnima" : "Amavasya") : `${isShukla ? "Shukla" : "Krishna"} ${TITHI_NAMES[within]}`;
  const tithiRemainingDeg = 12 - (elong % 12);
  const tithiEndMs = dayStart.getTime() + (tithiRemainingDeg / 12.19) * 86400000;

  // Nakshatra
  const nakIndex = Math.floor(moon / (360 / 27));
  const nakRemDeg = (360 / 27) - (moon % (360 / 27));
  const nakEndMs = dayStart.getTime() + (nakRemDeg / 13.176) * 86400000;
  const pada = Math.floor((moon % (360 / 27)) / (360 / 108)) + 1;

  // Yoga & karana
  const yogaIndex = Math.floor(norm360(moon + sun) / (360 / 27));
  const karanaIndex = Math.floor(elong / 6);
  const karanaName =
    karanaIndex === 0
      ? KARANA_FIRST
      : karanaIndex >= 57
        ? KARANA_FIXED_END[karanaIndex - 57]
        : KARANA_CYCLE[(karanaIndex - 1) % 7];

  // Inauspicious periods (fractions of daytime)
  const daytime: TimeRange = { start: sunrise, end: sunset };
  const rahuKaal = part(daytime, RAHU_PART[weekdayIndex]);
  const yamaganda = part(daytime, YAMAGANDA_PART[weekdayIndex]);
  const gulika = part(daytime, GULIKA_PART[weekdayIndex]);

  // Abhijit muhurat: 8th of 15 muhurtas ≈ midday ± 24 min
  const abhijit: TimeRange = {
    start: addMinutes(solarNoon, -24),
    end: addMinutes(solarNoon, 24),
  };

  // Choghadiya
  const dayMinutes = hhmmToMinutes(sunset) - hhmmToMinutes(sunrise);
  const nightEnd = addMinutes(sunset, 1440 - dayMinutes); // next day's sunrise ≈ sunset + same span
  const mkSlot = (i: number, startMin: number, span: number, startIdx: number): ChoghadiyaSlot => {
    const name = CHOGHADIYA_NAMES[(startIdx + i) % 7];
    const s = startMin + span * i;
    return {
      name,
      quality: CHOGHADIYA_QUALITY[name],
      start: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`,
      end: `${String(Math.floor((s + span) / 60)).padStart(2, "0")}:${String(Math.round((s + span) % 60)).padStart(2, "0")}`,
    };
  };
  const dayStartIdx = CHOGHADIYA_DAY_START[weekdayIndex];
  const nightStartIdx = (dayStartIdx + 5) % 7;
  const choghadiyaDay = Array.from({ length: 8 }, (_, i) =>
    mkSlot(i, hhmmToMinutes(sunrise), dayMinutes / 8, dayStartIdx)
  );
  const choghadiyaNight = Array.from({ length: 8 }, (_, i) =>
    mkSlot(i, hhmmToMinutes(sunset), dayMinutes / 8, nightStartIdx)
  );

  // Moonrise/moonset: elongation-based interpolation (new moon rises with the
  // sun, full moon rises at sunset) — plausible demo approximation
  const sunriseMin = hhmmToMinutes(sunrise);
  const moonriseMin = Math.round(sunriseMin + (elong / 180) * dayMinutes) % 1440;
  const moonrise = `${String(Math.floor(moonriseMin / 60)).padStart(2, "0")}:${String(moonriseMin % 60).padStart(2, "0")}`;
  const moonsetMin = (moonriseMin + 720) % 1440;
  const moonset = `${String(Math.floor(moonsetMin / 60)).padStart(2, "0")}:${String(moonsetMin % 60).padStart(2, "0")}`;

  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
    }).format(new Date(ms));

  const simpleSummary = `Today is ${tithiName} tithi with the Moon in ${NAKSHATRAS[nakIndex]}. Avoid starting important work during Rahu Kaal (${rahuKaal.start}–${rahuKaal.end}). ${abbrWeekday(weekdayIndex)} is ruled by ${VARA_LORDS[weekdayIndex]}.`;

  return {
    provider,
    date: dateStr,
    location,
    sunrise,
    sunset,
    moonrise,
    moonset,
    tithi: {
      name: tithiName,
      phase: isShukla ? "Waxing (Shukla Paksha)" : "Waning (Krishna Paksha)",
      endDate: fmtDate(tithiEndMs),
    },
    nakshatra: { name: NAKSHATRAS[nakIndex], pada, endDate: fmtDate(nakEndMs) },
    yoga: { name: YOGA_NAMES[yogaIndex] },
    karana: { name: karanaName },
    vara: { name: VARA_NAMES[weekdayIndex], lord: VARA_LORDS[weekdayIndex] },
    rahuKaal,
    yamaganda,
    gulika,
    abhijitMuhurat: abhijit,
    choghadiya: { day: choghadiyaDay, night: choghadiyaNight },
    simpleSummary,
  };
}

function abbrWeekday(i: number): string {
  return VARA_NAMES[i];
}

/** Which choghadiya slot is active now (local time), for the home card. */
export function currentChoghadiya(
  p: PanchangData,
  nowLocalHHMM: string
): { name: ChoghadiyaName; quality: "good" | "neutral" | "avoid"; ends: string } | null {
  const now = hhmmToMinutes(nowLocalHHMM);
  for (const slot of [...p.choghadiya.day, ...p.choghadiya.night]) {
    const s = hhmmToMinutes(slot.start);
    const e = hhmmToMinutes(slot.end);
    const inRange = s <= e ? now >= s && now < e : now >= s || now < e;
    if (inRange) return { name: slot.name, quality: slot.quality, ends: slot.end };
  }
  return null;
}
