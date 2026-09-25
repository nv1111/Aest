import { http } from "@/lib/http";
import type { ReportDTO } from "@/types/models";

export type ReportType = "kundli" | "career" | "marriage" | "yearly" | "compatibility";

/** ReportDTO + the profile helpers the details screen uses. */
export interface ReportView extends ReportDTO {
  profileId?: string | null;
  profileName?: string | null;
}

export const reportService = {
  list: (limit = 20) => http.get<{ reports: ReportView[] }>(`/api/reports?limit=${limit}`),

  generate: (type: ReportType, profileId?: string) =>
    http.post<{ report: ReportView }>("/api/reports/generate", { type, profileId }),

  details: (id: string) => http.get<{ report: ReportView }>(`/api/reports/${id}`),
};
