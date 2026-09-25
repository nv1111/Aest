/**
 * Local astrology-feature API calls that need shapes beyond the shared
 * astrologyService (which is owned foundation code — do not edit).
 * The compatibility POST supports inline creation of profile B server-side.
 */
import { http } from "@/lib/http";
import type { CompatibilityResult } from "@/lib/astrology/types";

export interface InlineProfileB {
  name: string;
  relation?: "partner" | "family" | "other";
  dateOfBirth: string; // YYYY-MM-DD
  timeOfBirth: string | null; // HH:mm
  timeAccuracy: "exact" | "approximate" | "unknown";
  placeName: string;
  placeCountry?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface CompatibilityBody {
  profileAId: string;
  profileBId?: string;
  /** inline second person — created as a saved profile server-side */
  profileB?: InlineProfileB;
  /** display locale for engine-assembled strings (server-side Hindi) */
  locale?: "en" | "hi";
}

export const astrologyFeatureApi = {
  compatibility: (body: CompatibilityBody) =>
    http.post<CompatibilityResult>("/api/astrology/compatibility", body),
};

/** sessionStorage handoff key for the result screen. */
export const COMPAT_RESULT_KEY = "tara:compat-result";

/**
 * The stored result carries engine-assembled strings in ONE locale — remember
 * which one so the result screen never shows mixed-language data after a
 * mid-session language switch.
 */
interface CompatResultEnvelope {
  locale: "en" | "hi";
  result: CompatibilityResult;
}

function isValidResult(value: unknown): value is CompatibilityResult {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as CompatibilityResult).totalScore === "number" &&
    Array.isArray((value as CompatibilityResult).kootas)
  );
}

export function readCompatResult(locale: "en" | "hi"): CompatibilityResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(COMPAT_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !("locale" in parsed)) return null;
    const envelope = parsed as CompatResultEnvelope;
    // a result stored under another locale is not usable — fall back to POST
    if (envelope.locale !== locale || !isValidResult(envelope.result)) return null;
    return envelope.result;
  } catch {
    return null;
  }
}

export function storeCompatResult(result: CompatibilityResult, locale: "en" | "hi") {
  if (typeof window === "undefined") return;
  try {
    const envelope: CompatResultEnvelope = { locale, result };
    window.sessionStorage.setItem(COMPAT_RESULT_KEY, JSON.stringify(envelope));
  } catch {
    // storage full/blocked — the result screen will re-POST instead
  }
}
