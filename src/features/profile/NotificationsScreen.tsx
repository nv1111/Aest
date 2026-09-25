"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Bell, MessageSquare, Wallet, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { notificationService, type NotificationPrefs } from "@/services/notifications";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { TrustNote } from "@/components/shared/TrustNote";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Switch } from "@/components/ui/switch";

const CATEGORIES: {
  key: keyof NotificationPrefs;
  icon: typeof Bell;
  titleKey: string;
  subKey: string;
}[] = [
  { key: "daily", icon: Sparkles, titleKey: "profile.notifDaily", subKey: "profile.notifDailySub" },
  {
    key: "consultations",
    icon: MessageSquare,
    titleKey: "profile.notifConsultations",
    subKey: "profile.notifConsultationsSub",
  },
  { key: "payments", icon: Wallet, titleKey: "profile.notifPayments", subKey: "profile.notifPaymentsSub" },
  { key: "reports", icon: FileText, titleKey: "profile.notifReports", subKey: "profile.notifReportsSub" },
  { key: "events", icon: CalendarClock, titleKey: "profile.notifEvents", subKey: "profile.notifEventsSub" },
];

/** Notification settings — per-category switches, saved instantly (optimistic). */
export function NotificationsScreen() {
  const query = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationService.preferences(),
    staleTime: 60_000,
  });

  // Local override layer on top of the server value — no effect needed.
  const [localPrefs, setLocalPrefs] = useState<NotificationPrefs | null>(null);
  const prefs = localPrefs ?? query.data?.preferences ?? null;

  const save = async (next: NotificationPrefs) => {
    const prev = localPrefs ?? query.data?.preferences ?? null;
    setLocalPrefs(next); // optimistic
    try {
      await notificationService.savePreferences(next);
    } catch (err) {
      if (prev) setLocalPrefs(prev); // revert
      toast.error(t("profile.notifSaveFailed"), { description: errorMessage(err) });
    }
  };

  return (
    <ScreenScaffold title={t("profile.notifications")} width="default">
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError || !prefs ? (
        <ErrorState title={t("common.errorGeneric")} onRetry={() => query.refetch()} />
      ) : (
        <div className="space-y-5 pt-1">
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-hairline/70">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex min-h-14 items-center gap-3.5 px-4 py-3">
                <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
                  <c.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug">{t(c.titleKey)}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{t(c.subKey)}</p>
                </div>
                <Switch
                  checked={prefs[c.key]}
                  onCheckedChange={(checked) => save({ ...prefs, [c.key]: checked })}
                  aria-label={t(c.titleKey)}
                />
              </div>
            ))}
          </div>

          <TrustNote variant="info">{t("profile.notifNote")}</TrustNote>
        </div>
      )}
    </ScreenScaffold>
  );
}

export default NotificationsScreen;
