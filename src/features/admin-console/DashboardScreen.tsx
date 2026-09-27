"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LifeBuoy, MessageCircle, MoonStar, Phone, UserRound, Video } from "lucide-react";
import { adminConsoleService } from "@/services/console";
import type { AdminDashboardDTO, ConsoleConsultationDTO } from "@/types/console";
import { t } from "@/i18n";
import { formatDateIN, formatINR } from "@/lib/money";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Admin console → Dashboard (id "admin.dashboard").
 * Platform health at a glance: metrics poll every 15s; recent customers and
 * latest consultations below. Warm and calm, numbers in display type.
 *
 * NOTE: AdminDashboardDTO.recentConsultations is ConsoleConsultationDTO[] —
 * it has no astrologer name. The "with {astrologer}" line is joined
 * client-side from the admin consultations list (id → displayName map).
 */

const MODE_ICON = { chat: MessageCircle, audio: Phone, video: Video } as const;
const FALLBACK_MODE_ICON = MessageCircle;

function ConsultStatusChip({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
        {t("console.common.statusActive")}
      </span>
    );
  }
  const label =
    status === "requested"
      ? t("console.common.statusRequested")
      : status === "cancelled"
        ? t("console.common.statusCancelled")
        : t("console.common.statusEnded");
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3.5",
        highlight ? "border-warning/50 bg-warning/8" : "border-border"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-[22px] font-semibold leading-none text-foreground">{value}</p>
      {sub != null ? <div className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function RecentUserRow({ u }: { u: { id: string; name: string | null; phone: string | null; createdAt: string } }) {
  const label = u.name ?? u.phone ?? "—";
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <Avatar className="h-9 w-9 rounded-xl border">
        <AvatarFallback className="rounded-xl bg-secondary text-[11.5px] font-semibold text-secondary-foreground">
          {u.name
            ? u.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">{label}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{formatDateIN(u.createdAt)}</p>
      </div>
      {u.phone && u.name ? (
        <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{u.phone}</span>
      ) : null}
    </div>
  );
}

function RecentConsultationRow({
  c,
  astrologerName,
}: {
  c: ConsoleConsultationDTO;
  astrologerName?: string;
}) {
  const ModeIcon = MODE_ICON[(c.mode as keyof typeof MODE_ICON) ?? "chat"] ?? FALLBACK_MODE_ICON;
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <ModeIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
          {c.user.name ?? c.user.phone ?? "—"}
          {astrologerName ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              {t("console.admin.dash.with")} <span className="font-semibold text-foreground">{astrologerName}</span>
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {formatDateIN(c.createdAt, "datetime")}
          {c.durationSeconds ? ` · ${Math.round(c.durationSeconds / 60)}${t("console.common.minutes")}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <ConsultStatusChip status={c.status} />
        <span className="text-[12.5px] font-semibold text-foreground">
          {c.totalAmount != null ? formatINR(c.totalAmount) : "—"}
        </span>
      </div>
    </div>
  );
}

function DashboardBody({
  d,
  astrologerNames,
}: {
  d: AdminDashboardDTO;
  astrologerNames: Map<string, string>;
}) {
  const m = d.metrics;
  const active = m.activeConsultations > 0;

  return (
    <div className="space-y-6 pt-1">
      {/* ---------------------------------------------------------- metrics */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        aria-label={t("console.admin.dash.subtitle")}
      >
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <MetricCard
            label={t("console.admin.dash.users")}
            value={m.totalUsers}
            sub={t("console.admin.dash.newUsersSub", { count: m.newUsers7d })}
          />
          <MetricCard
            label={t("console.admin.dash.consultations")}
            value={m.totalConsultations}
            highlight={active}
            sub={
              active ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-warning">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" aria-hidden />
                  {t("console.admin.dash.activeNowSub", { count: m.activeConsultations })}
                </span>
              ) : (
                t("console.admin.dash.activeNowSub", { count: m.activeConsultations })
              )
            }
          />
          <MetricCard
            label={t("console.admin.dash.revenue")}
            value={formatINR(m.grossRevenue)}
            sub={t("console.admin.dash.walletLiabilitySub", { amount: formatINR(m.walletLiability) })}
          />
          <MetricCard
            label={t("console.admin.dash.astrologers")}
            value={m.astrologersTotal}
            sub={`${t("console.admin.dash.onlineSub", { count: m.astrologersOnline })} · ${t("console.admin.dash.pendingKycSub", { count: m.pendingKyc })}`}
          />
          <div className="col-span-2">
            <MetricCard label={t("console.admin.dash.openTickets")} value={m.openTickets} />
          </div>
          <div className="col-span-2">
            <MetricCard label={t("console.admin.dash.reports")} value={m.reportsGenerated} />
          </div>
        </div>
      </motion.section>

      {/* ---------------------------------------------------- new customers */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.06, ease: "easeOut" }}
      >
        <SectionHeader>{t("console.admin.dash.recentUsers")}</SectionHeader>
        {d.recentUsers.length === 0 ? (
          <EmptyState icon={UserRound} title={t("console.admin.dash.empty")} body={t("console.admin.dash.subtitle")} />
        ) : (
          <ul className="divide-y divide-hairline/70 overflow-hidden rounded-2xl border bg-card">
            {d.recentUsers.map((u) => (
              <li key={u.id}>
                <RecentUserRow u={u} />
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* ---------------------------------------------- latest consultations */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.12, ease: "easeOut" }}
      >
        <SectionHeader>{t("console.admin.dash.recentConsultations")}</SectionHeader>
        {d.recentConsultations.length === 0 ? (
          <EmptyState
            icon={MoonStar}
            title={t("console.admin.dash.empty")}
            body={t("console.admin.consultations.subtitle")}
          />
        ) : (
          <ul className="divide-y divide-hairline/70 overflow-hidden rounded-2xl border bg-card">
            {d.recentConsultations.map((c) => (
              <li key={c.id}>
                <RecentConsultationRow c={c} astrologerName={astrologerNames.get(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  );
}

export default function DashboardScreen() {
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminConsoleService.dashboard(),
    refetchInterval: 15_000,
  });

  // Secondary join: consultation id → astrologer displayName for the recent
  // list (ConsoleConsultationDTO carries no astrologer name).
  const listQuery = useQuery({
    queryKey: ["admin", "consultations", ""],
    queryFn: () => adminConsoleService.consultations(),
    staleTime: 30_000,
  });

  const astrologerNames = new Map<string, string>(
    (listQuery.data?.consultations ?? []).map((c) => [c.id, c.astrologer.displayName])
  );

  return (
    <ConsoleScreen
      title={t("console.admin.dash.title")}
      subtitle={t("console.admin.dash.subtitle")}
      width="wide"
    >
      {query.isLoading ? (
        <PageSkeleton variant="cards" />
      ) : query.isError ? (
        <ErrorState
          icon={LifeBuoy}
          title={t("console.common.loadError")}
          onRetry={() => query.refetch()}
        />
      ) : query.data ? (
        <DashboardBody d={query.data} astrologerNames={astrologerNames} />
      ) : null}
    </ConsoleScreen>
  );
}
