import { http } from "@/lib/http";
import type { NotificationDTO } from "@/types/models";

export interface NotificationPrefs {
  daily: boolean;
  consultations: boolean;
  payments: boolean;
  reports: boolean;
  events: boolean;
}

export const notificationService = {
  list: (limit = 50) => http.get<{ notifications: NotificationDTO[] }>(`/api/notifications?limit=${limit}`),

  readAll: () => http.post<{ ok: true; updated: number }>("/api/notifications/read-all"),

  preferences: () => http.get<{ preferences: NotificationPrefs }>("/api/notifications/preferences"),

  savePreferences: (prefs: NotificationPrefs) =>
    http.post<{ preferences: NotificationPrefs }>("/api/notifications/preferences", prefs),
};
