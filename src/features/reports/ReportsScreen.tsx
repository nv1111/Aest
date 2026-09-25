"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, FileText, Heart, ScrollText, Users, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { reportService, type ReportType } from "@/services/reports";
import { useMe } from "@/hooks/useSession";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { trackEvent } from "@/lib/analytics";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TEMPLATES: { type: ReportType; icon: typeof ScrollText; titleKey: string; descKey: string }[] = [
  { type: "kundli", icon: ScrollText, titleKey: "reports.typeKundli", descKey: "reports.templateKundliDesc" },
  { type: "career", icon: Briefcase, titleKey: "reports.typeCareer", descKey: "reports.templateCareerDesc" },
  { type: "marriage", icon: Heart, titleKey: "reports.typeMarriage", descKey: "reports.templateMarriageDesc" },
  { type: "yearly", icon: CalendarDays, titleKey: "reports.typeYearly", descKey: "reports.templateYearlyDesc" },
  { type: "compatibility", icon: Users, titleKey: "reports.typeCompatibility", descKey: "reports.templateCompatibilityDesc" },
];

/** Reports — generate templates + your saved reports. */
export function ReportsScreen() {
  const me = useMe();
  const push = useAppStore((s) => s.push);
  const qc = useQueryClient();
  const profileId = me.data?.primaryProfile?.id;
  const profileName = me.data?.primaryProfile?.name;

  const list = useQuery({
    queryKey: ["reports", "list"],
    queryFn: () => reportService.list(50),
    staleTime: 30_000,
  });

  const generate = useMutation({
    mutationFn: (type: ReportType) => reportService.generate(type, profileId),
    onSuccess: (res, type) => {
      trackEvent("report_generated", { type });
      void qc.invalidateQueries({ queryKey: ["reports", "list"] });
      push({ id: "reports.details", params: { id: res.report.id } });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!me.isLoading && !profileId) {
    return (
      <ScreenScaffold title={t("reports.title")}>
        <EmptyState
          icon={FileText}
          title={t("reports.noProfileTitle")}
          body={t("reports.noProfileBody")}
          actionLabel={t("home.noProfileCta")}
          onAction={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={t("reports.title")} subtitle={t("reports.subtitle")}>
      <div className="space-y-7 pt-1">
        {/* ------------------------------------------------ generate zone */}
        <section aria-label={t("reports.generateZone")}>
          <SectionHeader action={<DemoDataBadge />}>{t("reports.generateZone")}</SectionHeader>
          {profileName ? (
            <p className="mb-2.5 px-1 text-[12px] text-muted-foreground">
              {t("reports.builtFrom", { name: profileName })}
            </p>
          ) : null}
          <div className="space-y-2.5">
            {TEMPLATES.map((tpl, i) => (
              <motion.button
                key={tpl.type}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                disabled={generate.isPending}
                onClick={() => generate.mutate(tpl.type)}
                className="press flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/50 disabled:opacity-60"
                aria-label={t(tpl.titleKey)}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <tpl.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">{t(tpl.titleKey)}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                    {t(tpl.descKey)}
                  </span>
                </span>
                <span className="shrink-0">
                  {generate.isPending && generate.variables === tpl.type ? (
                    <GeneratingChip />
                  ) : (
                    <span className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground">
                      {t("reports.generate")}
                    </span>
                  )}
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ your reports */}
        <section aria-label={t("reports.yourReports")}>
          <SectionHeader>{t("reports.yourReports")}</SectionHeader>
          {list.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : list.isError ? (
            <ErrorState title={t("common.errorGeneric")} onRetry={() => list.refetch()} />
          ) : (list.data?.reports.length ?? 0) === 0 ? (
            <EmptyState icon={FileText} title={t("reports.noReports")} body={t("reports.noReportsBody")} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-hairline/70">
              {list.data?.reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => push({ id: "reports.details", params: { id: r.id } })}
                  className="press flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-secondary/50"
                  aria-label={r.title}
                >
                  <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
                    <FileText className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{r.title}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {t("reports.created")} {formatDateIN(r.createdAt)}
                    </span>
                  </span>
                  <ReportStatusChip status={r.status} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </ScreenScaffold>
  );
}

export default ReportsScreen;

function GeneratingChip() {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
      <span className="tara-shimmer h-2 w-2 rounded-full bg-primary" />
      {t("reports.generatingBtn")}
    </span>
  );
}

export function ReportStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ready: { label: t("reports.ready"), className: "bg-success/10 text-success" },
    generating: { label: t("reports.statusGenerating"), className: "bg-warning/15 text-warning-foreground" },
    failed: { label: t("reports.failed"), className: "bg-destructive/10 text-destructive" },
  };
  const entry = map[status] ?? { label: status, className: "bg-secondary text-muted-foreground" };
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide", entry.className)}>
      {entry.label}
    </span>
  );
}
