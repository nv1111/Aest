"use client";

import { create } from "zustand";
import type { AstrologerFilters } from "@/services/astrologers";

/**
 * Marketplace filter state — zustand (module-level) so filters survive
 * pushes into a profile and back. Single-select per group keeps the API
 * contract simple (substring/number params).
 */

export type PriceBucket = "any" | "under15" | "r15to20" | "r20to25" | "r25plus";
export type RatingFloor = "any" | "4" | "4.5";
export type ExperienceFloor = "any" | "5" | "10" | "20";
export type ModeFilter = "any" | "chat" | "audio" | "video";

interface FilterState {
  expertise: string | null;
  language: string | null;
  price: PriceBucket;
  rating: RatingFloor;
  experience: ExperienceFloor;
  mode: ModeFilter;
  setExpertise: (v: string | null) => void;
  setLanguage: (v: string | null) => void;
  setPrice: (v: PriceBucket) => void;
  setRating: (v: RatingFloor) => void;
  setExperience: (v: ExperienceFloor) => void;
  setMode: (v: ModeFilter) => void;
  clear: () => void;
}

const initial = {
  expertise: null as string | null,
  language: null as string | null,
  price: "any" as PriceBucket,
  rating: "any" as RatingFloor,
  experience: "any" as ExperienceFloor,
  mode: "any" as ModeFilter,
};

export const useAstrologerFilters = create<FilterState>((set) => ({
  ...initial,
  setExpertise: (v) => set({ expertise: v }),
  setLanguage: (v) => set({ language: v }),
  setPrice: (v) => set({ price: v }),
  setRating: (v) => set({ rating: v }),
  setExperience: (v) => set({ experience: v }),
  setMode: (v) => set({ mode: v }),
  clear: () => set({ ...initial }),
}));

export function filtersToApi(s: FilterState): AstrologerFilters {
  const f: AstrologerFilters = {};
  if (s.expertise) f.expertise = s.expertise;
  if (s.language) f.language = s.language;
  if (s.price === "under15") f.maxPrice = 15;
  if (s.price === "r15to20") {
    f.minPrice = 15;
    f.maxPrice = 20;
  }
  if (s.price === "r20to25") {
    f.minPrice = 20;
    f.maxPrice = 25;
  }
  if (s.price === "r25plus") f.minPrice = 25;
  if (s.rating === "4") f.minRating = 4;
  if (s.rating === "4.5") f.minRating = 4.5;
  if (s.experience === "5") f.minExperience = 5;
  if (s.experience === "10") f.minExperience = 10;
  if (s.experience === "20") f.minExperience = 20;
  if (s.mode !== "any") f.mode = s.mode;
  return f;
}

export function activeFilterCount(s: FilterState): number {
  let n = 0;
  if (s.expertise) n += 1;
  if (s.language) n += 1;
  if (s.price !== "any") n += 1;
  if (s.rating !== "any") n += 1;
  if (s.experience !== "any") n += 1;
  if (s.mode !== "any") n += 1;
  return n;
}
