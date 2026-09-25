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
}

export const astrologyFeatureApi = {
  compatibility: (body: CompatibilityBody) =>
    http.post<CompatibilityResult>("/api/astrology/compatibility", body),
};

/** sessionStorage handoff key for the result screen. */
export const COMPAT_RESULT_KEY = "tara:compat-result";

export function readCompatResult(): CompatibilityResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(COMPAT_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompatibilityResult;
    if (!parsed || typeof parsed.totalScore !== "number" || !Array.isArray(parsed.kootas)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeCompatResult(result: CompatibilityResult) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(COMPAT_RESULT_KEY, JSON.stringify(result));
  } catch {
    // storage full/blocked — the result screen will re-POST instead
  }
}
