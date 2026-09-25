/**
 * NORMALIZED ASTROLOGY INTERFACES — the single contract between UI and engines.
 *
 * The UI must NEVER compute astrology. It renders these structures only.
 * All dates over the wire are ISO strings; all money/time formatting happens client-side.
 *
 * Current provider: MockAstrologyProvider (deterministic, clearly labeled demo).
 * A real verified engine must implement AstrologyProvider with zero UI changes.
 */

// ------------------------------------------------------------------ primitives

export type PlanetName =
  | "Sun"
  | "Moon"
  | "Mars"
  | "Mercury"
  | "Jupiter"
  | "Venus"
  | "Saturn"
  | "Rahu"
  | "Ketu";

export const PLANETS: PlanetName[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export type SignName = (typeof SIGNS)[number];

export const SIGN_SANSKRIT: Record<string, string> = {
  Aries: "Mesha",
  Taurus: "Vrishabha",
  Gemini: "Mithuna",
  Cancer: "Karka",
  Leo: "Simha",
  Virgo: "Kanya",
  Libra: "Tula",
  Scorpio: "Vrishchika",
  Sagittarius: "Dhanu",
  Capricorn: "Makara",
  Aquarius: "Kumbha",
  Pisces: "Meena",
};

export const SIGN_LORDS: Record<string, PlanetName> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishtha",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

export type NakshatraName = (typeof NAKSHATRAS)[number];

/** Vimshottari dasha lords in order, with their year spans. */
export const DASHA_ORDER: { lord: PlanetName; years: number }[] = [
  { lord: "Ketu", years: 7 },
  { lord: "Venus", years: 20 },
  { lord: "Sun", years: 6 },
  { lord: "Moon", years: 10 },
  { lord: "Mars", years: 7 },
  { lord: "Rahu", years: 18 },
  { lord: "Jupiter", years: 16 },
  { lord: "Saturn", years: 19 },
  { lord: "Mercury", years: 17 },
];

/** Lord of each nakshatra (Vimshottari cycle, repeats every 9). */
export function nakshatraLord(index: number): PlanetName {
  return DASHA_ORDER[index % 9].lord;
}

export type TimeAccuracy = "exact" | "approximate" | "unknown";

// ------------------------------------------------------------------ provider

export interface ProviderInfo {
  id: string;
  mode: "mock" | "live";
  label: string;
  /** Shown to users wherever mock-computed data is displayed. */
  disclaimer: string;
}

export interface AstrologyInput {
  name: string;
  dateOfBirth: string; // YYYY-MM-DD
  timeOfBirth: string | null; // HH:mm — null when unknown
  timeAccuracy: TimeAccuracy;
  placeName: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

// ------------------------------------------------------------------ chart

export interface PlanetPosition {
  planet: PlanetName;
  /** Sidereal longitude 0–360. */
  longitude: number;
  sign: SignName;
  signIndex: number;
  degreeInSign: number;
  /** Whole-sign house 1–12 relative to the ascendant. */
  house: number;
  nakshatra: NakshatraName;
  nakshatraPada: 1 | 2 | 3 | 4;
  nakshatraLord: PlanetName;
  signLord: PlanetName;
  isRetrograde: boolean;
}

export interface HouseInfo {
  house: number;
  sign: SignName;
  signIndex: number;
  signLord: PlanetName;
  planets: PlanetName[];
  /** One-line plain-language meaning of this house area of life. */
  theme: string;
}

export const HOUSE_THEMES: Record<number, string> = {
  1: "Self, body, how you show up",
  2: "Money, food, family, speech",
  3: "Effort, siblings, communication, courage",
  4: "Home, mother, inner peace, property",
  5: "Creativity, children, learning, romance",
  6: "Work, health, routines, service",
  7: "Partnership, marriage, contracts",
  8: "Depth, transformation, shared resources",
  9: "Luck, teachers, travel, beliefs",
  10: "Career, status, responsibility",
  11: "Community, gains, friendships",
  12: "Rest, letting go, foreign lands, solitude",
};

export interface AscendantInfo {
  sign: SignName;
  signIndex: number;
  degreeInSign: number;
  lord: PlanetName;
  isApproximate: boolean; // true when birth time unknown/approximate
}

export interface DivisionalChart {
  id: "D1" | "D9";
  name: string;
  description: string;
  houses: { house: number; sign: SignName; planets: PlanetName[] }[];
}

export interface BirthChart {
  provider: ProviderInfo;
  input: AstrologyInput;
  ascendant: AscendantInfo;
  moonSign: { sign: SignName; signIndex: number; sanskrit: string };
  sunSign: { sign: SignName; sanskrit: string };
  nakshatra: { name: NakshatraName; pada: 1 | 2 | 3 | 4; lord: PlanetName };
  planets: PlanetPosition[];
  houses: HouseInfo[];
  divisional: DivisionalChart[];
  /** Plain-language highlights, max 4, no jargon without explanation. */
  keyHighlights: { title: string; body: string }[];
  note: string; // time-accuracy note shown to the user
}

// ------------------------------------------------------------------ dasha

export interface DashaPeriod {
  lord: PlanetName;
  start: string; // ISO
  end: string; // ISO
}

export interface DashaSubPeriod extends DashaPeriod {
  parent: PlanetName;
}

export interface DashaInfo {
  provider: ProviderInfo;
  asOf: string;
  current: {
    mahadasha: DashaPeriod;
    antardasha: DashaSubPeriod;
    pratyantardasha: DashaSubPeriod | null;
  };
  /** All mahadashas across the 120-year cycle with progress for the active one. */
  timeline: (DashaPeriod & { isActive: boolean; progress: number })[];
  /** Antardasha list inside the current mahadasha. */
  antardashas: (DashaSubPeriod & { isActive: boolean })[];
  /** Pratyantardashas inside the current antardasha. */
  pratyantardashas: DashaSubPeriod[];
  simpleReading: { headline: string; body: string };
}

// ------------------------------------------------------------------ transit

export interface TransitEntry {
  planet: PlanetName;
  currentSign: SignName;
  currentSignIndex: number;
  /** House in the user's natal chart this transit activates. */
  natalHouse: number;
  startedOn: string;
  endsOn: string;
  isRetrograde: boolean;
  interpretation: string;
}

export interface TransitInfo {
  provider: ProviderInfo;
  asOf: string;
  transits: TransitEntry[];
  notable: string[];
}

// ------------------------------------------------------------------ panchang

export interface TimeRange {
  start: string; // HH:mm local
  end: string;
}

export type ChoghadiyaName =
  | "Udveg"
  | "Chal"
  | "Labh"
  | "Amrit"
  | "Kaag"
  | "Shubh"
  | "Rog";

export interface ChoghadiyaSlot extends TimeRange {
  name: ChoghadiyaName;
  quality: "good" | "neutral" | "avoid";
}

export interface PanchangData {
  provider: ProviderInfo;
  date: string; // YYYY-MM-DD
  location: { name: string; latitude: number; longitude: number; timezone: string };
  sunrise: string; // HH:mm
  sunset: string;
  moonrise: string | null;
  moonset: string | null;
  tithi: { name: string; phase: string; endDate: string };
  nakshatra: { name: NakshatraName; pada: number; endDate: string };
  yoga: { name: string };
  karana: { name: string };
  vara: { name: string; lord: PlanetName };
  rahuKaal: TimeRange;
  yamaganda: TimeRange;
  gulika: TimeRange;
  abhijitMuhurat: TimeRange;
  choghadiya: { day: ChoghadiyaSlot[]; night: ChoghadiyaSlot[] };
  simpleSummary: string;
}

// ------------------------------------------------------------------ horoscope

export type HoroscopePeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface HoroscopeReading {
  provider: ProviderInfo;
  period: HoroscopePeriod;
  /** Honest disclosure of what the content is based on. */
  basis: string;
  moonSign: SignName;
  dateLabel: string;
  headline: string;
  summary: string;
  sections: { title: string; body: string }[];
  /** 1–5, presented as "energy today" — never as fate. */
  rating: number;
}

// ------------------------------------------------------------------ compatibility

export interface KootaScore {
  key: string;
  name: string; // e.g. "Varna"
  sanskritHint: string;
  meaning: string; // one-line plain meaning
  max: number;
  score: number;
  detail: string;
}

export interface CompatibilityResult {
  provider: ProviderInfo;
  profileA: { id: string; name: string };
  profileB: { id: string; name: string };
  totalScore: number;
  maxScore: 36;
  verdict: string; // non-absolute, calm language
  kootas: KootaScore[];
  manglik: { a: boolean; b: boolean; note: string };
  themes: { title: string; body: string }[];
  disclaimers: string[];
}

// ------------------------------------------------------------------ home / day

export interface DayInsight {
  headline: string;
  body: string;
  factors: { label: string; value: string }[];
}

export interface HomeAstrology {
  insight: DayInsight;
  today: {
    tithi: string;
    nakshatra: string;
    nakshatraPada: number;
    rahuKaal: TimeRange;
    choghadiyaNow: { name: ChoghadiyaName; quality: "good" | "neutral" | "avoid"; ends: string } | null;
    sunrise: string;
    sunset: string;
  };
  dasha: { line: string; sub: string };
  transit: { line: string };
}

// ------------------------------------------------------------------ provider

export interface AstrologyProvider {
  readonly info: ProviderInfo;
  getBirthChart(input: AstrologyInput): BirthChart;
  getDasha(input: AstrologyInput, asOf?: Date): DashaInfo;
  getTransit(input: AstrologyInput, asOf?: Date): TransitInfo;
  getPanchang(date: string, location: { name: string; latitude: number; longitude: number; timezone: string }): PanchangData;
  getHoroscope(input: AstrologyInput, period: HoroscopePeriod, asOf?: Date): HoroscopeReading;
  getCompatibility(
    a: { id: string; input: AstrologyInput },
    b: { id: string; input: AstrologyInput }
  ): CompatibilityResult;
  getHomeAstrology(input: AstrologyInput, asOf?: Date): HomeAstrology;
}
