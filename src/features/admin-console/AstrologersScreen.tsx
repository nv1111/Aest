"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldAlert, Star, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { adminConsoleService } from "@/services/console";
import type { AdminAstrologerDTO } from "@/types/console";
import { t } from "@/i18n";
import { formatINR } from "@/lib/money";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
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

/**
 * Admin console → Astrologers (id "admin.astrologers") — the KYC queue.
 * Filters are client-side over the full list; KYC actions (approve / reject /
 * suspend) hit /api/admin/astrologers/{id}/kyc, invalidate every admin query
 * (dashboard metrics move too) and toast the outcome.
 */

type KycAction = "approve" | "reject" | "suspend";
type Filter = "all" | "pending" | "approved" | "suspended";

const FILTERS: { id: Filter; labelKey: string }[] = [
  { id: "pending", labelKey: "console.admin.astrologers.filterPending" },
  { id: "all", labelKey: "console.admin.astrologers.filterAll" },
  { id: "approved", labelKey: "console.admin.astrologers.filterApproved" },
  { id: "suspended", labelKey: "console.admin.astrologers.filterSuspended" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function KycBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
        {t("console.admin.astrologers.statusPending")}
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success">
        <BadgeCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        {t("console.admin.astrologers.statusApproved")}
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
        <ShieldAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        {t("console.admin.astrologers.statusSuspended")}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
      {t("console.admin.astrologers.statusRejected")}
    </span>
  );
}

function VerifiedChip({ verified }: { verified: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold",
        verified ? "text-success" : "text-muted-foreground"
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      {verified ? t("console.admin.astrologers.verified") : t("console.admin.astrologers.unverified")}
    </span>
  );
}

function AstrologerCard({
  a,
  onAction,
  pendingAction,
}: {
  a: AdminAstrologerDTO;
  onAction: (a: AdminAstrologerDTO, action: KycAction) => void;
  pendingAction: KycAction | null;
}) {
  const busy = pendingAction != null;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-13 w-13 rounded-2xl border">
            <AvatarImage src={a.photoUrl ?? undefined} alt={a.displayName} />
            <AvatarFallback className="rounded-2xl bg-secondary font-display text-[15px] font-semibold text-secondary-foreground">
              {initials(a.displayName)}
            </AvatarFallback>
          </Avatar>
          <span
            aria-label={a.onlineStatus}
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
              a.onlineStatus === "online" ? "bg-success" : "bg-muted-foreground/50"
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[14.5px] font-semibold leading-tight text-foreground">{a.displayName}</h3>
            <VerifiedChip verified={a.isVerified} />
            {a.operatedByConsole ? (
              <span className="shrink-0 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                {t("console.admin.astrologers.operated")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[12px] text-muted-foreground">
            {a.expertise.slice(0, 2).join(" · ")}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{a.languages.slice(0, 2).join(", ")}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
              {a.rating.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {a.reviewCount} {t("astrologers.reviews")}
            </span>
            <span aria-hidden>·</span>
            <span className="font-semibold text-foreground">
              {formatINR(a.pricePerMinute)}
              <span className="font-medium text-muted-foreground">{t("console.common.perMin")}</span>
            </span>
          </div>
        </div>

        <KycBadge status={a.kycStatus} />
      </div>

      {/* actions */}
      {a.kycStatus === "pending" ? (
        <div className="mt-3.5 flex gap-2.5">
          <Button
            variant="default"
            className="press h-11 flex-1 rounded-full text-[13.5px] font-semibold"
            disabled={busy}
            onClick={() => onAction(a, "approve")}
          >
            {pendingAction === "approve" ? t("console.common.loading") : t("console.admin.astrologers.approve")}
          </Button>
          <Button
            variant="outline"
            className="press h-11 flex-1 rounded-full text-[13.5px] font-semibold"
            disabled={busy}
            onClick={() => onAction(a, "reject")}
          >
            {t("console.admin.astrologers.reject")}
          </Button>
        </div>
      ) : a.kycStatus === "approved" ? (
        <div className="mt-3.5">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onAction(a, "suspend")}
            className="press h-11 w-full rounded-full border-destructive/40 text-[13px] font-semibold text-destructive hover:bg-destructive/8 hover:text-destructive"
          >
            {pendingAction === "suspend" ? t("console.common.loading") : t("console.admin.astrologers.suspend")}
          </Button>
        </div>
      ) : null}
    </motion.article>
  );
}

export default function AstrologersScreen() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [confirm, setConfirm] = useState<{ a: AdminAstrologerDTO; action: "reject" | "suspend" } | null>(null);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admin", "astrologers"],
    queryFn: () => adminConsoleService.astrologers(),
    staleTime: 30_000,
  });

  const astrologers = query.data?.astrologers ?? [];

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: astrologers.length, pending: 0, approved: 0, suspended: 0 };
    for (const a of astrologers) {
      if (a.kycStatus === "pending") c.pending += 1;
      if (a.kycStatus === "approved") c.approved += 1;
      if (a.kycStatus === "suspended") c.suspended += 1;
    }
    return c;
  }, [astrologers]);

  const kyc = useMutation({
    mutationFn: ({ id, action }: { id: string; action: KycAction; name: string }) =>
      adminConsoleService.kyc(id, action),
    onSuccess: (_res, { action, name }) => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      if (action === "approve") toast.success(t("console.admin.astrologers.approveToast", { name }));
      if (action === "reject") toast.success(t("console.admin.astrologers.rejectToast", { name }));
      if (action === "suspend") toast.success(t("console.admin.astrologers.suspendToast", { name }));
    },
    onError: () => toast.error(t("console.admin.astrologers.actionFailed")),
  });

  const onAction = (a: AdminAstrologerDTO, action: KycAction) => {
    if (action === "approve") {
      kyc.mutate({ id: a.id, action, name: a.displayName });
      return;
    }
    setConfirm({ a, action });
  };

  const visible = useMemo(() => {
    if (filter === "all") return astrologers;
    return astrologers.filter((a) => a.kycStatus === filter);
  }, [astrologers, filter]);

  const busyFor = (id: string): KycAction | null => {
    if (!kyc.isPending || !kyc.variables) return null;
    return kyc.variables.id === id ? kyc.variables.action : null;
  };

  const confirmActionLabel =
    confirm?.action === "reject"
      ? t("console.admin.astrologers.reject")
      : t("console.admin.astrologers.suspend");

  return (
    <ConsoleScreen
      title={t("console.admin.astrologers.title")}
      subtitle={t("console.admin.astrologers.subtitle")}
    >
      {/* filter chips with live status counts */}
      <div
        role="tablist"
        aria-label={t("console.admin.astrologers.title")}
        className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "press flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <span>{counts[f.id]}</span>
              <span>{t(f.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {query.isLoading ? (
          <PageSkeleton variant="list" />
        ) : query.isError ? (
          <ErrorState
            icon={UserRoundX}
            title={t("console.common.loadError")}
            onRetry={() => query.refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={t("console.admin.astrologers.empty")}
            body={t("console.admin.astrologers.subtitle")}
          />
        ) : (
          <ul className="space-y-2.5">
            {visible.map((a) => (
              <li key={a.id}>
                <AstrologerCard a={a} onAction={onAction} pendingAction={busyFor(a.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* reject / suspend confirmation */}
      <AlertDialog open={confirm != null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "reject"
                ? t("console.admin.astrologers.rejectConfirmTitle")
                : t("console.admin.astrologers.suspendConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "reject"
                ? t("console.admin.astrologers.rejectConfirmDesc")
                : t("console.admin.astrologers.suspendConfirmDesc")}
              {confirm ? ` — ${confirm.a.displayName}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="press h-11 rounded-full px-5">{t("console.demo.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="press h-11 rounded-full bg-destructive px-5 text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirm) {
                  kyc.mutate({ id: confirm.a.id, action: confirm.action, name: confirm.a.displayName });
                }
                setConfirm(null);
              }}
            >
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConsoleScreen>
  );
}
