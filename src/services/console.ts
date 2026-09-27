/**
 * Console services — Phase 2 role-switch demo (client-side).
 * Contract with /api/astrologer-console/* and /api/admin/* (see
 * src/types/console.ts for the DTO shapes).
 */

import { http } from "@/lib/http";
import type {
  AdminAstrologerDTO,
  AdminConsultationDTO,
  AdminDashboardDTO,
  AdminSupportTicketDTO,
  AstrologerContextDTO,
  AstrologerDashboardDTO,
  ConsoleConsultationDTO,
} from "@/types/console";
import type { MessageDTO } from "@/types/models";

// ------------------------------------------------------------ persona switch

export const demoService = {
  /** Switch role-switch demo persona (server persists on the User row). */
  setPersona: (persona: "user" | "astrologer" | "admin", astrologerId?: string) =>
    http.post<{ demoPersona: string | null; astrologer?: { id: string; displayName: string } }>(
      "/api/demo/persona",
      astrologerId ? { persona, astrologerId } : { persona }
    ),
};

// -------------------------------------------------------- astrologer console

export const astrologerConsoleService = {
  /** Dashboard: astrologer profile, earnings, queue, active, recent, reviews. */
  dashboard: () => http.get<AstrologerDashboardDTO>("/api/astrologer-console/dashboard"),

  /** Toggle availability: online | away | offline. */
  setAvailability: (onlineStatus: "online" | "away" | "offline") =>
    http.post<{ onlineStatus: string }>("/api/astrologer-console/availability", { onlineStatus }),

  /** Accept an incoming request → status active, chat opens. */
  accept: (consultationId: string) =>
    http.post<{ consultation: ConsoleConsultationDTO }>(
      `/api/astrologer-console/consultations/${consultationId}/accept`,
      {}
    ),

  /** Decline an incoming request → status cancelled. */
  reject: (consultationId: string) =>
    http.post<{ consultation: ConsoleConsultationDTO }>(
      `/api/astrologer-console/consultations/${consultationId}/reject`,
      {}
    ),

  /** Full transcript of one consultation (console view). */
  messages: (consultationId: string) =>
    http.get<{ consultation: ConsoleConsultationDTO; messages: MessageDTO[] }>(
      `/api/astrologer-console/consultations/${consultationId}/messages`
    ),

  /** Manual reply as the astrologer. */
  sendMessage: (consultationId: string, content: string) =>
    http.post<{ message: MessageDTO }>(`/api/astrologer-console/consultations/${consultationId}/messages`, {
      content,
    }),

  /** Kundli context panel (consent-flagged) for the consultation's user. */
  context: (consultationId: string) =>
    http.get<AstrologerContextDTO>(`/api/astrologer-console/consultations/${consultationId}/context`),

  /** HMAC relay ticket for the socket room (console-side join). */
  ticket: (consultationId: string) =>
    http.post<{ ticket: string }>(`/api/astrologer-console/consultations/${consultationId}/ticket`, {}),

  /** End the consultation and settle billing. */
  end: (consultationId: string) =>
    http.post<{ consultation: ConsoleConsultationDTO }>(
      `/api/astrologer-console/consultations/${consultationId}/end`,
      {}
    ),
};

// ---------------------------------------------------------------- admin

export const adminConsoleService = {
  dashboard: () => http.get<AdminDashboardDTO>("/api/admin/dashboard"),

  astrologers: () => http.get<{ astrologers: AdminAstrologerDTO[] }>("/api/admin/astrologers"),

  /** KYC action: approve | reject | suspend. */
  kyc: (astrologerId: string, action: "approve" | "reject" | "suspend") =>
    http.post<{ astrologer: AdminAstrologerDTO }>(`/api/admin/astrologers/${astrologerId}/kyc`, {
      action,
    }),

  /** All consultations (optional status filter: active | ended | cancelled). */
  consultations: (status?: string) =>
    http.get<{ consultations: AdminConsultationDTO[] }>(
      `/api/admin/consultations${status ? `?status=${status}` : ""}`
    ),

  /** Refund the settled amount back to the customer's wallet. */
  refund: (consultationId: string) =>
    http.post<{ refunded: number }>(`/api/admin/consultations/${consultationId}/refund`, {}),

  /** Support tickets (optional status filter: open | in_progress | resolved). */
  support: (status?: string) =>
    http.get<{ tickets: AdminSupportTicketDTO[] }>(`/api/admin/support${status ? `?status=${status}` : ""}`),

  /** Reply to a ticket; `resolved` closes it. */
  replyTicket: (ticketId: string, response: string, resolved?: boolean) =>
    http.post<{ ticket: AdminSupportTicketDTO }>(`/api/admin/support/${ticketId}/reply`, {
      response,
      resolved: resolved ?? undefined,
    }),
};
