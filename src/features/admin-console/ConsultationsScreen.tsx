"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, MoonStar, Phone, RotateCcw, Video } from "lucide-react";
import { toast } from "sonner";
import { adminConsoleService } from "@/services/console";
import type { AdminConsultationDTO } from "@/types/console";
import { t } from "@/i18n";
import { formatDateIN, formatDuration, formatINR } from "@/lib/money";
import { ApiError, errorMessage } from "@/lib/http";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
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

/**
 * Admin console → Consultations (id "admin.consultations").
 * Server-side status filter (all | active | ended | cancelled) with smooth
 * keep-previous-data transitions. Ended consultations expose the wallet
 * refund action — 409s map to their own copy (already refunded / nothing to
 * refund). Tapping a row expands the summary + timeline inline.
 */

type Filter = "" | "active" | "ended" | "cancelled";

const FILTERS: { id: Filter; labelKey: string }[] = [
  { id: "", labelKey: "console.admin.consultations.filterAll" },
  { id: "active", labelKey: "console.admin.consultations.filterActive" },
  { id: "ended", labelKey: "console.admin.consultations.filterEnded" },
  { id: "cancelled", labelKey: "console.admin.consultations.filterCancelled" },
];

const MODE_ICON = { chat: MessageCircle, audio: Phone, video: Video } as const;

function StatusChip({ status }: { status: string }) {
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

function modeLabel(mode: string) {
  if (mode === "audio") return t("console.common.modeAudio");
  if (mode === "video") return t("console.common.modeVideo");
  return t("console.common.modeChat");
}

function ConsultationCard({
  c,
  onRefund,
  refundPending,
}: {
  c: AdminConsultationDTO;
  onRefund: (c: AdminConsultationDTO) => void;
  refundPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const ModeIcon = MODE_ICON[(c.mode as keyof typeof MODE_ICON) ?? "chat"] ?? MessageCircle;
  const userName = c.user.name ?? c.user.phone ?? "—";
  const remaining = (c.totalAmount ?? 0) - c.refundedAmount;
  const canRefund = c.status === "ended" && remaining > 0;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="press block w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <ModeIcon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight text-foreground">
              {userName}
              <span className="font-normal text-muted-foreground">
                {" "}
                {t("console.admin.dash.with")} <span className="font-semibold text-foreground">{c.astrologer.displayName}</span>
              </span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {modeLabel(c.mode)} · {formatDateIN(c.createdAt, "datetime")}
              {c.durationSeconds ? ` · ${formatDuration(c.durationSeconds)}` : ""}
            </p>
            {c.summary ? (
              <p className="mt-1.5 line-clamp-1 text-[12px] leading-snug text-muted-foreground">
                <span className="font-semibold text-foreground/70">{t("console.admin.consultations.summaryLabel")}: </span>
                {c.summary}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusChip status={c.status} />
            <span className="text-[13px] font-semibold text-foreground">
              {c.totalAmount != null ? formatINR(c.totalAmount) : "—"}
            </span>
            {c.refundedAmount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                <RotateCcw className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                {t("console.admin.dash.refundedBadge")} {formatINR(c.refundedAmount)}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {/* expanded detail: full summary + timeline */}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-hairline px-4 pb-4 pt-3 text-[12px] text-muted-foreground">
              {c.summary ? (
                <p className="leading-relaxed">
                  <span className="font-semibold text-foreground/70">{t("console.admin.consultations.summaryLabel")}: </span>
                  {c.summary}
                </p>
              ) : null}
              <p>
                {t("console.admin.consultations.duration")}:{" "}
                <span className="font-medium text-foreground">
                  {c.durationSeconds != null ? formatDuration(c.durationSeconds) : "—"}
                </span>
              </p>
              <p>
                {t("console.admin.consultations.amount")}:{" "}
                <span className="font-medium text-foreground">
                  {c.totalAmount != null ? formatINR(c.totalAmount) : "—"}
                </span>
                {c.refundedAmount > 0 ? (
                  <span>
                    {" · "}
                    {t("console.admin.consultations.refunded")}:{" "}
                    <span className="font-medium text-success">{formatINR(c.refundedAmount)}</span>
                  </span>
                ) : null}
              </p>
              <p>
                {formatINR(c.ratePerMinute)}
                <span className="text-muted-foreground/80">{t("console.common.perMin")}</span>
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* refund action */}
      {canRefund ? (
        <div className="border-t border-hairline p-3">
          <Button
            variant="outline"
            disabled={refundPending}
            onClick={() => onRefund(c)}
            className="press h-11 w-full rounded-full text-[13px] font-semibold"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
            {refundPending ? t("console.common.loading") : t("console.admin.consultations.refund")}
            {remaining > 0 ? <span className="text-muted-foreground">· {formatINR(remaining)}</span> : null}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export default function ConsultationsScreen() {
  const [filter, setFilter] = useState<Filter>("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "consultations", filter],
    queryFn: () => adminConsoleService.consultations(filter || undefined),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const consultations = query.data?.consultations ?? [];
  const confirmTarget = consultations.find((c) => c.id === confirmId) ?? null;

  const refund = useMutation({
    mutationFn: (c: AdminConsultationDTO) => adminConsoleService.refund(c.id),
    onSuccess: (res, c) => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(
        t("console.admin.consultations.refundToast", {
          amount: formatINR(res.refunded),
          name: c.user.name ?? c.user.phone ?? "—",
        })
      );
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.code === "already_refunded") return toast.error(t("console.admin.consultations.alreadyRefunded"));
        if (err.code === "not_refundable") return toast.error(t("console.admin.consultations.nothingToRefund"));
        return toast.error(errorMessage(err));
      }
      toast.error(t("console.admin.consultations.refundFailed"));
    },
  });

  const list = query.data ? consultations : [];

  return (
    <ConsoleScreen
      title={t("console.admin.consultations.title")}
      subtitle={t("console.admin.consultations.subtitle")}
      width="wide"
    >
      {/* server-side status filter chips */}
      <div
        role="tablist"
        aria-label={t("console.admin.consultations.title")}
        className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "press flex h-10 shrink-0 items-center rounded-full border px-4 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {t(f.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {query.isLoading ? (
          <PageSkeleton variant="list" />
        ) : query.isError ? (
          <ErrorState
            icon={MoonStar}
            title={t("console.common.loadError")}
            onRetry={() => query.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={MoonStar}
            title={t("console.admin.consultations.empty")}
            body={t("console.admin.consultations.subtitle")}
          />
        ) : (
          <ul className="space-y-2.5 lg:grid lg:grid-cols-2 lg:space-y-0 lg:gap-x-3 lg:gap-y-2.5">
            {list.map((c) => (
              <li key={c.id}>
                <ConsultationCard
                  c={c}
                  onRefund={(target) => setConfirmId(target.id)}
                  refundPending={refund.isPending && refund.variables?.id === c.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* refund confirmation */}
      <AlertDialog open={confirmId != null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("console.admin.consultations.refundConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("console.admin.consultations.refundConfirmDesc")}
              {confirmTarget
                ? ` — ${confirmTarget.user.name ?? confirmTarget.user.phone ?? "—"} · ${formatINR(
                    (confirmTarget.totalAmount ?? 0) - confirmTarget.refundedAmount
                  )}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="press h-11 rounded-full px-5">{t("console.demo.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="press h-11 rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (confirmTarget) refund.mutate(confirmTarget);
                setConfirmId(null);
              }}
            >
              {t("console.admin.consultations.refundConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConsoleScreen>
  );
}
