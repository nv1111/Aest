"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  CalendarClock,
  FileText,
  MessageSquare,
  Sparkles,
  Wallet,
} from "lucide-react";
import { notificationService } from "@/services/notifications";
import { useRefreshMe } from "@/hooks/useSession";
import { t } from "@/i18n";
import { formatDateIN } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import type { NotificationDTO } from "@/types/models";
import { cn } from "@/lib/utils";

/** Notification center — history with unread markers; opening marks all read. */
export function NotificationCenterScreen() {
  const qc = useQueryClient();
  const refreshMe = useRefreshMe();

  const query = useQuery({
    queryKey: ["notifications", "center"],
    queryFn: () => notificationService.list(50),
    staleTime: 15_000,
  });

  // Marking all read happens once, when the list first arrives.
  const markedRef = useRef(false);
  useEffect(() => {
    if (!query.data || markedRef.current) return;
    markedRef.current = true;
    const hasUnread = query.data.notifications.some((n) => n.readAt === null);
    if (!hasUnread) return;
    void (async () => {
      try {
        await notificationService.readAll();
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["notifications", "center"] }),
          refreshMe(),
        ]);
      } catch {
        // silent — unread state is cosmetic, retry happens next visit
      }
    })();
  }, [query.data, qc, refreshMe]);

  return (
    <ScreenScaffold title={t("profile.notificationCenter")} width="default">
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <ErrorState title={t("common.errorGeneric")} onRetry={() => query.refetch()} />
      ) : (query.data?.notifications.length ?? 0) === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={t("profile.allCaughtUp")}
          body={t("profile.allCaughtUpBody")}
        />
      ) : (
        <div className="space-y-2.5 pt-1">
          {query.data?.notifications.map((n, i) => (
            <NotificationRow key={n.id} n={n} index={i} />
          ))}
        </div>
      )}
    </ScreenScaffold>
  );
}

export default NotificationCenterScreen;

function NotificationRow({ n, index }: { n: NotificationDTO; index: number }) {
  const unread = n.readAt === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.25), duration: 0.25 }}
      className={cn(
        "flex items-start gap-3.5 rounded-2xl border bg-card p-4",
        unread ? "border-primary/25" : "border-border"
      )}
    >
      <span
        className={cn(
          "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl",
          unread ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground/75"
        )}
      >
        <NotificationIcon type={n.type} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-[13.5px] leading-snug", unread ? "font-semibold" : "font-medium text-foreground/85")}>
            {n.title}
          </p>
          {unread ? (
            <span aria-label="unread" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          ) : null}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{n.body}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">{relativeTime(n.createdAt)}</p>
      </div>
    </motion.div>
  );
}

/** Icon per notification type — map lookup, calm and consistent. */
const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  consultation_update: MessageSquare,
  astrologer_reply: MessageSquare,
  payment: Wallet,
  wallet: Wallet,
  report: FileText,
  daily: Sparkles,
  event: CalendarClock,
};

function NotificationIcon({ type }: { type: string }) {
  const Icon = NOTIFICATION_ICONS[type] ?? Bell;
  return <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />;
}

/** Relative time — falls back to formatDateIN for anything older than a week. */
function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return t("common.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateIN(d);
}
