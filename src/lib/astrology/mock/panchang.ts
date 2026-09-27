/**
 * Panchang, Rahu Kaal family, Choghadiya — SHARED builder (position-source
 * agnostic: mock and live engines both feed it through PanchangPositions).
 * Sunrise/sunset default from the NOAA-style formulas in positions.ts; the
 * live engine overrides with astronomy-engine event search.
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
  CHOGHADIYA_HI,
  KARANA_HI,
  NAKSHATRA_HI,
  VARA_HI,
  YOGA_HI,
  planetName,
  tithiName as localizedTithi,
} from "../names";
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

const CHOGHADIYA_MEANING_HI: Record<ChoghadiyaName, string> = {
  Amrit: "सबसे अच्छा समय — काम आसानी से बनते हैं",
  Shubh: "शुभ कार्यों के लिए अच्छा समय",
  Labh: "लाभ और व्यापार के लिए अच्छा समय",
  Chal: "साधारण समय — रोज़मर्रा के काम",
  Udveg: "महत्वपूर्ण काम शुरू न करें",
  Kaag: "टालें — परंपरा के अनुसार अशुभ",
  Rog: "टालें — परंपरा के अनुसार अशुभ",
};

export function choghadiyaMeaning(name: ChoghadiyaName): string {
  return CHOGHADIYA_MEANING[name];
}

export function choghadiyaMeaningHi(name: ChoghadiyaName): string {
  return CHOGHADIYA_MEANING_HI[name];
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

/**
 * Panchang builder — position-source agnostic. The mock engine feeds its
 * approximate longitudes; the live engine feeds real ephemeris values.
 * Tithi/nakshatra end-times are solved from the actual motion of the source.
 */

export interface PanchangPositions {
  moonLongitude(date: Date): number;
  sunLongitude(date: Date): number;
  solarEvents(
    dateStr: string,
    latitude: number,
    longitudeDeg: number,
    timezone: string
  ): { sunriseUTC: Date; sunsetUTC: Date; solarNoonUTC: Date };
  lunarEvents?(
    dateStr: string,
    latitude: number,
    longitudeDeg: number,
    timezone: string
  ): { moonriseUTC: Date | null; moonsetUTC: Date | null };
}

const mockPositions: PanchangPositions = {
  moonLongitude: (d) => siderealLongitude("Moon", d),
  sunLongitude: (d) => siderealLongitude("Sun", d),
  solarEvents,
};

const H_MS = 3600000;
const wrapDiff = (a: number, b: number): number => {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

/** Solve when fn reaches the next multiple of `span` degrees after startMs (Newton). */
function nextCrossingMs(fn: (d: Date) => number, span: number, startMs: number): number {
  const v0 = fn(new Date(startMs));
  const target = Math.floor(v0 / span) * span + span;
  const rate = wrapDiff(fn(new Date(startMs + H_MS)), fn(new Date(startMs - H_MS))) / 2; // deg/hour
  if (!isFinite(rate) || rate <= 0) return startMs + 86400000; // degenerate fallback
  let t = startMs + ((target - v0) / rate) * H_MS;
  for (let i = 0; i < 3; i++) {
    t -= (wrapDiff(fn(new Date(t)), target) / rate) * H_MS;
  }
  return t;
}

export function buildPanchang(
  dateStr: string,
  location: { name: string; latitude: number; longitude: number; timezone: string },
  provider: PanchangData["provider"],
  locale: "en" | "hi" = "en",
  positions: PanchangPositions = mockPositions
): PanchangData {
  const { latitude, longitude, timezone } = location;
  const events = positions.solarEvents(dateStr, latitude, longitude, timezone);
  const sunrise = toLocalHHMM(events.sunriseUTC, timezone);
  const sunset = toLocalHHMM(events.sunsetUTC, timezone);
  const solarNoon = toLocalHHMM(events.solarNoonUTC, timezone);

  const dayStart = localToUTC(dateStr, "12:00", timezone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(dayStart);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);

  // Panchang convention: tithi/nakshatra state at sunrise
  const ref = events.sunriseUTC;
  const moon = positions.moonLongitude(ref);
  const sun = positions.sunLongitude(ref);
  const elong = norm360(moon - sun);

  // Tithi
  const tithiIndex = Math.floor(elong / 12); // 0..29
  const isShukla = tithiIndex < 15;
  const within = tithiIndex % 15;
  const tithiName =
    within === 14 ? (isShukla ? "Purnima" : "Amavasya") : `${isShukla ? "Shukla" : "Krishna"} ${TITHI_NAMES[within]}`;
  const elongFn = (d: Date) => norm360(positions.moonLongitude(d) - positions.sunLongitude(d));
  const tithiEndMs = nextCrossingMs(elongFn, 12, ref.getTime());

  // Nakshatra
  const nakIndex = Math.floor(moon / (360 / 27));
  const moonFn = (d: Date) => positions.moonLongitude(d);
  const nakEndMs = nextCrossingMs(moonFn, 360 / 27, ref.getTime());
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

  // Moonrise/moonset: real event search when the source supports it,
  // elongation-based interpolation otherwise.
  let moonrise: string | null;
  let moonset: string | null;
  if (positions.lunarEvents) {
    const le = positions.lunarEvents(dateStr, latitude, longitude, timezone);
    moonrise = le.moonriseUTC ? toLocalHHMM(le.moonriseUTC, timezone) : null;
    moonset = le.moonsetUTC ? toLocalHHMM(le.moonsetUTC, timezone) : null;
  } else {
    const sunriseMin = hhmmToMinutes(sunrise);
    const moonriseMin = Math.round(sunriseMin + (elong / 180) * dayMinutes) % 1440;
    moonrise = `${String(Math.floor(moonriseMin / 60)).padStart(2, "0")}:${String(moonriseMin % 60).padStart(2, "0")}`;
    const moonsetMin = (moonriseMin + 720) % 1440;
    moonset = `${String(Math.floor(moonsetMin / 60)).padStart(2, "0")}:${String(moonsetMin % 60).padStart(2, "0")}`;
  }

  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
    }).format(new Date(ms));

  // localized display names (English enums stay the compute keys)
  const tithiDisplay = localizedTithi(tithiName, locale);
  const nakshatraDisplay = locale === "hi" ? NAKSHATRA_HI[nakIndex] : NAKSHATRAS[nakIndex];
  const yogaDisplay = locale === "hi" ? YOGA_HI[YOGA_NAMES[yogaIndex]] : YOGA_NAMES[yogaIndex];
  const karanaDisplay = locale === "hi" ? KARANA_HI[karanaName] : karanaName;
  const varaDisplay = locale === "hi" ? VARA_HI[VARA_NAMES[weekdayIndex]] : VARA_NAMES[weekdayIndex];
  const chogDisplay = (n: ChoghadiyaName) => (locale === "hi" ? CHOGHADIYA_HI[n] : n);

  const simpleSummary =
    locale === "hi"
      ? `आज ${tithiDisplay} तिथि है और चंद्र ${nakshatraDisplay} नक्षत्र में है। राहु काल (${rahuKaal.start}–${rahuKaal.end}) में महत्वपूर्ण काम शुरू न करें। ${varaDisplay} के स्वामी ${planetName(VARA_LORDS[weekdayIndex], "hi")} हैं।`
      : `Today is ${tithiName} tithi with the Moon in ${NAKSHATRAS[nakIndex]}. Avoid starting important work during Rahu Kaal (${rahuKaal.start}–${rahuKaal.end}). ${abbrWeekday(weekdayIndex)} is ruled by ${VARA_LORDS[weekdayIndex]}.`;

  return {
    provider,
    date: dateStr,
    location,
    sunrise,
    sunset,
    moonrise,
    moonset,
    tithi: {
      name: tithiDisplay,
      phase: locale === "hi" ? (isShukla ? "बढ़ता (शुक्ल पक्ष)" : "घटता (कृष्ण पक्ष)") : isShukla ? "Waxing (Shukla Paksha)" : "Waning (Krishna Paksha)",
      endDate: fmtDate(tithiEndMs),
    },
    nakshatra: { name: nakshatraDisplay, pada, endDate: fmtDate(nakEndMs) },
    yoga: { name: yogaDisplay },
    karana: { name: karanaDisplay },
    vara: { name: varaDisplay, lord: VARA_LORDS[weekdayIndex] },
    rahuKaal,
    yamaganda,
    gulika,
    abhijitMuhurat: abhijit,
    choghadiya: {
      day: choghadiyaDay.map((s) => ({ ...s, name: chogDisplay(s.name as ChoghadiyaName) })),
      night: choghadiyaNight.map((s) => ({ ...s, name: chogDisplay(s.name as ChoghadiyaName) })),
    },
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
): { name: string; quality: "good" | "neutral" | "avoid"; ends: string } | null {
  const now = hhmmToMinutes(nowLocalHHMM);
  for (const slot of [...p.choghadiya.day, ...p.choghadiya.night]) {
    const s = hhmmToMinutes(slot.start);
    const e = hhmmToMinutes(slot.end);
    const inRange = s <= e ? now >= s && now < e : now >= s || now < e;
    if (inRange) return { name: slot.name, quality: slot.quality, ends: slot.end };
  }
  return null;
}
