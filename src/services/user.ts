import { http } from "@/lib/http";
import type { UserDTO } from "@/types/models";

export interface AccountExportDTO {
  format: string;
  exportedAt: string;
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    name: string | null;
    language: string;
    createdAt: string;
  };
  birthProfiles: Record<string, unknown>[];
  consultations: Record<string, unknown>[];
  wallet: { balance: number; currency: string; transactions: Record<string, unknown>[] };
  reports: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  supportTickets: Record<string, unknown>[];
}

export const userService = {
  update: (input: { name?: string; language?: "en" }) =>
    http.post<{ user: UserDTO }>("/api/user", input),

  exportData: () => http.get<AccountExportDTO>("/api/account/export"),
};
