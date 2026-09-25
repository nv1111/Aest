import { http } from "@/lib/http";
import type { ConsultationDTO, MessageDTO } from "@/types/models";

export type ConsultationMode = "chat" | "audio" | "video";

/** consultationsService — the paid consultation flow (chat + billing). */
export const consultationsService = {
  /** User's own consultations, newest first. */
  list: (params: { limit?: number; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    const s = qs.toString();
    return http.get<{ consultations: ConsultationDTO[] }>(`/api/consultations${s ? `?${s}` : ""}`);
  },

  /** Consultation + full message transcript (own only). */
  get: (id: string) =>
    http.get<{ consultation: ConsultationDTO; messages: MessageDTO[] }>(`/api/consultations/${id}`),

  /** Create + start immediately (server checks balance ≥ 3 minutes). */
  start: (astrologerId: string, mode: ConsultationMode) =>
    http.post<{ consultation: ConsultationDTO }>("/api/consultations/start", { astrologerId, mode }),

  /** Send a message; the astrologer's reply arrives over the socket. */
  sendMessage: (id: string, content: string) =>
    http.post<{ message: MessageDTO }>(`/api/consultations/${id}/messages`, { content }),

  /** Mark the astrologer's messages read (chat is open). */
  markRead: (id: string) => http.post<{ updated: number }>(`/api/consultations/${id}/read`, {}),

  /** End + settle the bill (server-settled amount, wallet debit, summary). */
  end: (id: string) => http.post<{ consultation: ConsultationDTO }>(`/api/consultations/${id}/end`, {}),

  /** HMAC relay ticket for the socket.io chat service. */
  ticket: (id: string) => http.post<{ ticket: string }>(`/api/consultations/${id}/ticket`, {}),
};
