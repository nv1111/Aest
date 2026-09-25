import { http } from "@/lib/http";

export type SupportCategory = "general" | "billing" | "privacy" | "astrologer" | "bug";

export interface SupportTicketDTO {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
}

export const supportService = {
  create: (input: { category: SupportCategory; subject: string; message: string }) =>
    http.post<{ ticket: SupportTicketDTO }>("/api/support", input),
};
