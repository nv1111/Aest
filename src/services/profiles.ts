import { http } from "@/lib/http";
import type { BirthProfileDTO } from "@/types/models";

export interface BirthProfileInput {
  name: string;
  relation?: string;
  dateOfBirth: string;
  timeOfBirth?: string | null;
  timeAccuracy: "exact" | "approximate" | "unknown";
  placeName: string;
  placeCountry?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** profileService — birth profile CRUD. */
export const profileService = {
  create: (input: BirthProfileInput) =>
    http.post<BirthProfileDTO>("/api/profiles", input),

  update: (id: string, input: Partial<BirthProfileInput>) =>
    http.patch<BirthProfileDTO>(`/api/profiles/${id}`, input),

  remove: (id: string) => http.delete<{ ok: true }>(`/api/profiles/${id}`),

  completeOnboarding: () => http.post<{ ok: true }>("/api/profiles/complete-onboarding"),
};
