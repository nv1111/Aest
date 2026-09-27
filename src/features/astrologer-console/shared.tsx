"use client";

/**
 * Shared pieces for the astrologer-console screens (2-c).
 *
 * One dashboard query feeds the Dashboard, Chats and Reviews tabs (10s poll =
 * live queue); the request actions (accept/decline), the queue/active/ended
 * consultation cards and the star row are identical across screens, so they
 * live here.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, CheckCheck, MessageCircle, Phone, Star, Video } from "lucide-react";
import { toast } from "sonner";
import { astrologerConsoleService } from "@/services/console";
import type { AstrologerDashboardDTO, ConsoleConsultationDTO } from "@/types/console";
import { useConsoleStore } from "@/store/console";
import { t } from "@/i18n";
import { formatDateIN, formatDuration, formatINR } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const CONSOLE_DASHBOARD_KEY = ["astrologer-console-dashboard"] as const;

/** Dashboard query shared by the Dashboard / Chats / Reviews tabs. */
export function useConsoleDashboard() {
  return useQuery({
    queryKey: CONSOLE_DASHBOARD_KEY,
    queryFn: () => astrologerConsoleService.dashboard(),
    refetchInterval: 10_000,
  });
}

/** 1-second tick while something is live (running durations). */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const MODE_ICON = { chat: MessageCircle, audio: Phone, video: Video } as const;

export function modeLabel(mode: string): string {
  if (mode === "audio") return t("console.common.modeAudio");
  if (mode === "video") return t("console.common.modeVideo");
  return t("console.common.modeChat");
}

export function statusLabel(status: string): string {
  if (status === "active") return t("console.common.statusActive");
  if (status === "requested") return t("console.common.statusRequested");
  if (status === "cancelled") return t("console.common.statusCancelled");
  return t("console.common.statusEnded");
}

/** Running duration since startedAt (ticked by useTicker) or settled duration. */
export function consultationDuration(c: ConsoleConsultationDTO, now: number): string {
  if (c.status === "active" && c.startedAt) {
    return formatDuration(Math.max(0, Math.floor((now - new Date(c.startedAt).getTime()) / 1000)));
  }
  return c.durationSeconds ? formatDuration(c.durationSeconds) : "—";
}

// ------------------------------------------------------------------ avatars

export function CustomerAvatar({
  name,
  className,
  fallbackClassName,
}: {
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("rounded-xl border", className)}>
      <AvatarFallback
        className={cn(
          "rounded-xl bg-secondary text-[12px] font-semibold text-secondary-foreground",
          fallbackClassName
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// -------------------------------------------------------------------- stars

export function StarRow({ rating, className }: { rating: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("console.reviews.average", { rating })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i <= Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground/40")}
          aria-hidden
        />
      ))}
    </span>
  );
}

// ------------------------------------------------------- request actions

/**
 * Accept / Decline buttons for a "requested" consultation, with the decline
 * confirmation dialog and failure toasts. Same mutations across the
 * Dashboard queue, the Chats tab and the pushed Chat screen.
 */
export function RequestActions({
  consultation,
  onAccepted,
  onDeclined,
  size = "default",
}: {
  consultation: ConsoleConsultationDTO;
  onAccepted?: (c: ConsoleConsultationDTO) => void;
  onDeclined?: (c: ConsoleConsultationDTO) => void;
  size?: "default" | "sm";
}) {
  const qc = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: CONSOLE_DASHBOARD_KEY });
    void qc.invalidateQueries({ queryKey: ["astrologer-console-chat", consultation.id] });
  };

  const accept = useMutation({
    mutationFn: () => astrologerConsoleService.accept(consultation.id),
    onSuccess: ({ consultation: updated }) => {
      invalidate();
      onAccepted?.(updated);
    },
    onError: (err) => toast.error(t("console.dash.acceptFailed"), { description: errorMessage(err) }),
  });

  const reject = useMutation({
    mutationFn: () => astrologerConsoleService.reject(consultation.id),
    onSuccess: ({ consultation: updated }) => {
      invalidate();
      onDeclined?.(updated);
    },
    onError: (err) => toast.error(t("console.dash.rejectFailed"), { description: errorMessage(err) }),
  });

  const h = size === "sm" ? "h-9 px-4 text-[12.5px]" : "h-11 px-5 text-[13.5px]";

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          className={cn("flex-1 rounded-full font-semibold press", h)}
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending ? t("common.loading") : t("console.dash.accept")}
        </Button>
        <Button
          variant="outline"
          className={cn("flex-1 rounded-full border-hairline font-medium text-muted-foreground press hover:text-foreground hover:bg-destructive/8 hover:text-destructive", h)}
          disabled={reject.isPending}
          onClick={() => setDeclineOpen(true)}
        >
          {t("console.dash.reject")}
        </Button>
      </div>

      <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <AlertDialogContent className="mx-auto max-w-[340px] rounded-3xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[17px] font-semibold">
              {t("console.dash.rejectConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {t("console.dash.rejectConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="h-11 flex-1 rounded-full">
              {t("console.demo.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 flex-1 rounded-full press bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                setDeclineOpen(false);
                reject.mutate();
              }}
            >
              {t("console.dash.rejectConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ------------------------------------------------------------- queue card

export function QueueCard({
  c,
  onAccepted,
}: {
  c: ConsoleConsultationDTO;
  onAccepted?: (c: ConsoleConsultationDTO) => void;
}) {
  const name = c.user.name ?? t("console.chat.contextUser");
  const Icon = MODE_ICON[(c.mode as keyof typeof MODE_ICON)] ?? MessageCircle;
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border border-primary/25 bg-card p-4 shadow-sm shadow-primary/5"
    >
      <div className="flex items-center gap-3">
        <CustomerAvatar name={name} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold leading-tight text-foreground">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("console.dash.modePrefix")} {modeLabel(c.mode)} · {formatDateIN(c.createdAt, "datetime")}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/8 px-2.5 py-1 text-[12px] font-semibold text-primary">
          {formatINR(c.ratePerMinute)}
          <span className="font-normal text-primary/70">{t("console.common.perMin")}</span>
        </span>
      </div>
      <div className="mt-3.5">
        <RequestActions consultation={c} onAccepted={onAccepted} />
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">{t("console.dash.queueHint")}</p>
    </motion.li>
  );
}

// ------------------------------------------------------------ active card

export function ActiveChatCard({ c, now }: { c: ConsoleConsultationDTO; now: number }) {
  const push = useConsoleStore((s) => s.push);
  const name = c.user.name ?? t("console.chat.contextUser");
  const Icon = MODE_ICON[(c.mode as keyof typeof MODE_ICON)] ?? MessageCircle;
  const open = () => push({ id: "ast.chat", params: { consultationId: c.id } });
  return (
    <li>
      <button
        type="button"
        onClick={open}
        className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-secondary/40"
        aria-label={`${name} — ${t("console.dash.activeTitle")}`}
      >
        <CustomerAvatar name={name} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14.5px] font-semibold leading-tight text-foreground">{name}</p>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-warning-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden />
              {t("console.dash.activeNowBadge")}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("console.common.durationAgo", { duration: consultationDuration(c, now) })} ·{" "}
            {formatINR(c.ratePerMinute)}
            {t("console.common.perMin")}
          </p>
        </div>
      </button>
    </li>
  );
}

// ------------------------------------------------------------- ended row

export function EndedRow({ c }: { c: ConsoleConsultationDTO }) {
  const push = useConsoleStore((s) => s.push);
  const name = c.user.name ?? t("console.chat.contextUser");
  const Icon = MODE_ICON[(c.mode as keyof typeof MODE_ICON)] ?? MessageCircle;
  const cancelled = c.status === "cancelled";
  const open = () => push({ id: "ast.chat", params: { consultationId: c.id } });
  return (
    <li>
      <button
        type="button"
        onClick={open}
        className="press flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-secondary/40"
        aria-label={`${name} — ${statusLabel(c.status)}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">{name}</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {formatDateIN(c.startedAt ?? c.createdAt, "datetime")}
            {c.durationSeconds ? ` · ${formatDuration(c.durationSeconds)}` : ""}
            {c.messageCount ? ` · ${t("console.common.messagesCount", { count: c.messageCount })}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              cancelled ? "bg-secondary text-muted-foreground" : "bg-secondary text-secondary-foreground"
            )}
          >
            {statusLabel(c.status)}
          </span>
          <span className={cn("text-[12.5px] font-semibold", cancelled ? "text-muted-foreground" : "text-foreground")}>
            {c.totalAmount != null ? formatINR(c.totalAmount) : "—"}
          </span>
        </div>
      </button>
    </li>
  );
}

/** Quiet empty note for secondary lists (keeps the dashboard calm). */
export function QuietEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 px-4 py-5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}

/** Tiny live-dot status chip (used in the chat header). */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-warning-foreground",
        className
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden />
      {t("console.dash.activeNowBadge")}
    </span>
  );
}

/** Read-tick pair under the console astrologer's own bubbles (single = sent, double = read by the customer). */
export function ReadTicks({ read, className }: { read: boolean; className?: string }) {
  return read ? (
    <CheckCheck className={cn("h-3.5 w-3.5 text-success", className)} aria-label={t("console.chat.readOwn")} />
  ) : (
    <Check className={cn("h-3.5 w-3.5 text-muted-foreground/60", className)} aria-label={t("console.chat.readOwn")} />
  );
}
