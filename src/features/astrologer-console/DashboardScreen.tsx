"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Inbox, LifeBuoy, Star } from "lucide-react";
import { toast } from "sonner";
import { astrologerConsoleService } from "@/services/console";
import type { AstrologerDashboardDTO, ConsoleConsultationDTO } from "@/types/console";
import { useConsoleStore } from "@/store/console";
import { t } from "@/i18n";
import { formatINR } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  CustomerAvatar,
  QueueCard,
  ActiveChatCard,
  EndedRow,
  QuietEmpty,
  StarRow,
  initials,
  useConsoleDashboard,
  useTicker,
} from "./shared";

/**
 * Astrologer console → Dashboard (tab root, id "ast.dashboard").
 *
 * The live surface of the console: identity + availability, earnings, the
 * incoming-request queue (10s poll), active chats with running durations,
 * recent consultations and a reviews preview. Everything read-only except
 * the availability toggle and the queue accept/decline actions.
 */

type Availability = "online" | "away" | "offline";

const AVAILABILITY_OPTIONS: { value: Availability; dot: string }[] = [
  { value: "online", dot: "bg-success" },
  { value: "away", dot: "bg-warning" },
  { value: "offline", dot: "bg-muted-foreground/50" },
];

function availabilityLabel(v: string): string {
  if (v === "online") return t("console.dash.online");
  if (v === "away") return t("console.dash.away");
  return t("console.dash.offline");
}

function GreetingCard({ d }: { d: AstrologerDashboardDTO }) {
  const a = d.astrologer;
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border bg-card p-4">
      <Avatar className="h-14 w-14 shrink-0 rounded-2xl border">
        {a.photoUrl ? <AvatarImage src={a.photoUrl} alt={a.displayName} /> : null}
        <AvatarFallback className="rounded-2xl bg-secondary font-display text-[17px] font-semibold text-secondary-foreground">
          {initials(a.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[19px] font-semibold leading-tight text-foreground">
          {t("console.dash.greeting", { name: a.displayName })}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-secondary-foreground">
            <Star className="h-3 w-3 fill-primary text-primary" aria-hidden />
            {a.rating.toFixed(1)} · {t("console.dash.statReviews", { count: a.reviewCount })}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-secondary-foreground">
            {t("console.dash.statYears", { years: a.experienceYears })}
          </span>
          <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11.5px] font-semibold text-primary">
            {formatINR(a.pricePerMinute)}
            {t("console.common.perMin")}
          </span>
        </div>
      </div>
    </div>
  );
}

function AvailabilityCard({ current }: { current: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Availability>(
    current === "online" || current === "away" ? current : "offline"
  );

  const mutation = useMutation({
    mutationFn: (onlineStatus: Availability) => astrologerConsoleService.setAvailability(onlineStatus),
    onSuccess: (_data, onlineStatus) => {
      void qc.invalidateQueries({ queryKey: ["astrologer-console-dashboard"] });
      // keep the optimistic value — the invalidation confirms it
      setSelected(onlineStatus);
    },
    onError: (err) => {
      setSelected(current === "online" || current === "away" ? (current as Availability) : "offline");
      toast.error(t("console.dash.availabilityFailed"), { description: errorMessage(err) });
    },
  });

  const pick = (v: Availability) => {
    if (v === selected || mutation.isPending) return;
    setSelected(v); // optimistic
    mutation.mutate(v);
  };

  return (
    <div className="rounded-2xl border bg-card p-4" role="group" aria-label={t("console.dash.availability")}>
      <div className="grid grid-cols-3 gap-1.5 rounded-full bg-secondary/60 p-1">
        {AVAILABILITY_OPTIONS.map(({ value, dot }) => {
          const active = selected === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={mutation.isPending}
              onClick={() => pick(value)}
              className={cn(
                "press flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors",
                active
                  ? value === "online"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", active ? dot : "bg-muted-foreground/40")} aria-hidden />
              {availabilityLabel(value)}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">{t("console.dash.availabilityNote")}</p>
    </div>
  );
}

function EarningsCard({ d }: { d: AstrologerDashboardDTO }) {
  const e = d.earnings;
  const cells = [
    { label: t("console.dash.earningsToday"), value: formatINR(e.today), highlight: true },
    { label: t("console.dash.earningsTotal"), value: formatINR(e.total) },
    { label: t("console.dash.pendingPayout"), value: formatINR(e.pendingPayout) },
    { label: t("console.dash.lifetimeConsultations"), value: String(e.lifetimeConsultations) },
  ];
  return (
    <div className="rounded-2xl border bg-card p-4">
      <SectionHeader className="px-0 pb-2">{t("console.dash.earningsTitle")}</SectionHeader>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={cn(
              "rounded-xl border p-3",
              cell.highlight ? "border-primary/25 bg-primary/6" : "bg-background/60"
            )}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {cell.label}
            </p>
            <p
              className={cn(
                "mt-1 font-display font-semibold leading-none",
                cell.highlight ? "text-[22px] text-primary" : "text-[19px] text-foreground"
              )}
            >
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardBody({ d }: { d: AstrologerDashboardDTO }) {
  const push = useConsoleStore((s) => s.push);
  const now = useTicker(d.active.length > 0);

  const onAccepted = (c: ConsoleConsultationDTO) => {
    push({ id: "ast.chat", params: { consultationId: c.id } });
  };

  return (
    <div className="space-y-6 pt-1">
      {/* --------------------------------------------- greeting + availability */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="space-y-3"
        aria-label={t("console.dash.greeting", { name: d.astrologer.displayName })}
      >
        <GreetingCard d={d} />
        <AvailabilityCard key={d.astrologer.onlineStatus} current={d.astrologer.onlineStatus} />
      </motion.section>

      {/* -------------------------------------------------------------- earnings */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
        aria-label={t("console.dash.earningsTitle")}
      >
        <EarningsCard d={d} />
      </motion.section>

      {/* ---------------------------------------------------- incoming requests */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" }}
        aria-label={t("console.dash.queueTitle")}
      >
        <SectionHeader>
          {t("console.dash.queueTitle")}
          {d.queue.length > 0 ? (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {d.queue.length}
            </span>
          ) : null}
        </SectionHeader>
        {d.queue.length === 0 ? (
          <EmptyState icon={Inbox} title={t("console.dash.queueEmpty")} body={t("console.dash.queueHint")} />
        ) : (
          <ul className="space-y-2.5">
            {d.queue.map((c) => (
              <QueueCard key={c.id} c={c} onAccepted={onAccepted} />
            ))}
          </ul>
        )}
      </motion.section>

      {/* --------------------------------------------------------- active chats */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15, ease: "easeOut" }}
        aria-label={t("console.dash.activeTitle")}
      >
        <SectionHeader>{t("console.dash.activeTitle")}</SectionHeader>
        {d.active.length === 0 ? (
          <QuietEmpty>{t("console.dash.activeEmpty")}</QuietEmpty>
        ) : (
          <ul className="space-y-2.5">
            {d.active.map((c) => (
              <ActiveChatCard key={c.id} c={c} now={now} />
            ))}
          </ul>
        )}
      </motion.section>

      {/* ------------------------------------------------- recent consultations */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2, ease: "easeOut" }}
        aria-label={t("console.dash.recentTitle")}
      >
        <SectionHeader>{t("console.dash.recentTitle")}</SectionHeader>
        {d.recentEnded.length === 0 ? (
          <QuietEmpty>{t("console.dash.recentEmpty")}</QuietEmpty>
        ) : (
          <ul className="divide-y divide-hairline/70 overflow-hidden rounded-2xl border bg-card">
            {d.recentEnded.map((c) => (
              <EndedRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </motion.section>

      {/* ------------------------------------------------------ reviews preview */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.25, ease: "easeOut" }}
        aria-label={t("console.dash.reviewsTitle")}
      >
        <SectionHeader
          action={
            <button
              type="button"
              onClick={() => push({ id: "ast.reviews" })}
              className="press text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
            >
              {t("console.dash.viewAll")}
            </button>
          }
        >
          {t("console.dash.reviewsTitle")}
        </SectionHeader>
        {d.reviews.length === 0 ? (
          <QuietEmpty>{t("console.dash.reviewsEmpty")}</QuietEmpty>
        ) : (
          <ul className="divide-y divide-hairline/70 overflow-hidden rounded-2xl border bg-card">
            {d.reviews.slice(0, 3).map((r) => (
              <li key={r.id} className="px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <StarRow rating={r.rating} />
                  <span className="truncate text-[12px] font-medium text-foreground">{r.authorName}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  );
}

export default function DashboardScreen() {
  const query = useConsoleDashboard();

  return (
    <ConsoleScreen title={t("console.nav.dashboard")} width="wide">
      {query.isLoading ? (
        <PageSkeleton variant="cards" />
      ) : query.isError ? (
        <ErrorState icon={LifeBuoy} title={t("console.common.loadError")} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <DashboardBody d={query.data} />
      ) : null}
    </ConsoleScreen>
  );
}
