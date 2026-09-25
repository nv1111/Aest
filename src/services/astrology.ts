import { http } from "@/lib/http";
import type {
  BirthChart,
  CompatibilityResult,
  DashaInfo,
  HomeAstrology,
  HoroscopePeriod,
  HoroscopeReading,
  PanchangData,
  TransitInfo,
} from "@/lib/astrology/types";
import type { Place } from "@/lib/cities";

/** astrologyService — normalized data from the provider via the API. */
export const astrologyService = {
  chart: (profileId: string) => http.get<BirthChart>(`/api/astrology/chart?profileId=${profileId}`),

  dasha: (profileId: string) => http.get<DashaInfo>(`/api/astrology/dasha?profileId=${profileId}`),

  transit: (profileId: string) => http.get<TransitInfo>(`/api/astrology/transit?profileId=${profileId}`),

  panchang: (date: string, profileId?: string) =>
    http.get<PanchangData>(`/api/astrology/panchang?date=${date}${profileId ? `&profileId=${profileId}` : ""}`),

  horoscope: (profileId: string, period: HoroscopePeriod) =>
    http.get<HoroscopeReading>(`/api/astrology/horoscope?profileId=${profileId}&period=${period}`),

  compatibility: (profileAId: string, profileBId: string) =>
    http.post<CompatibilityResult>("/api/astrology/compatibility", { profileAId, profileBId }),

  home: (profileId: string) => http.get<HomeAstrology>(`/api/astrology/home?profileId=${profileId}`),

  places: (q: string) => http.get<{ places: Place[] }>(`/api/astrology/places?q=${encodeURIComponent(q)}`),
};
