import { http } from "@/lib/http";
import type { MeDTO, OtpRequestDTO } from "@/types/models";

/** authService — all session flows go through the API (never localStorage). */
export const authService = {
  requestOtp: (phone: string) =>
    http.post<OtpRequestDTO>("/api/auth/request-otp", { phone }),

  verifyOtp: (phone: string, code: string, name?: string) =>
    http.post<{ user: MeDTO["user"]; isNewUser: boolean }>("/api/auth/verify-otp", {
      phone,
      code,
      name,
    }),

  logout: () => http.post<{ ok: true }>("/api/auth/logout"),

  me: () => http.get<MeDTO>("/api/auth/me"),

  deleteAccount: () => http.post<{ ok: true }>("/api/account/delete"),
};
