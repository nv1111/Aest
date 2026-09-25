import { http } from "@/lib/http";
import type { AstrologerDTO, ReviewDTO } from "@/types/models";

export interface AstrologerFilters {
  /** 'online' | 'soon' | 'top' | 'new' | 'recommended' — reserved sections */
  section?: string;
  limit?: number;
  /** substring match inside the expertise JSON */
  expertise?: string;
  /** substring match inside the languages JSON */
  language?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minExperience?: number;
  /** substring match inside consultationModes JSON: chat | audio | video */
  mode?: string;
  /** display-name contains */
  q?: string;
}

function buildQuery(f: AstrologerFilters): string {
  const params = new URLSearchParams();
  if (f.section) params.set("section", f.section);
  if (f.limit) params.set("limit", String(f.limit));
  if (f.expertise) params.set("expertise", f.expertise);
  if (f.language) params.set("language", f.language);
  if (f.minPrice != null) params.set("minPrice", String(f.minPrice));
  if (f.maxPrice != null) params.set("maxPrice", String(f.maxPrice));
  if (f.minRating != null) params.set("minRating", String(f.minRating));
  if (f.minExperience != null) params.set("minExperience", String(f.minExperience));
  if (f.mode) params.set("mode", f.mode);
  if (f.q) params.set("q", f.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** astrologersService — marketplace reads (public profile fields only). */
export const astrologersService = {
  list: (filters: AstrologerFilters = {}) =>
    http.get<{ astrologers: AstrologerDTO[] }>(`/api/astrologers${buildQuery(filters)}`),

  profile: (id: string) =>
    http.get<{ astrologer: AstrologerDTO; reviews: ReviewDTO[] }>(`/api/astrologers/${id}`),
};
