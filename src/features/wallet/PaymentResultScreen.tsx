"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { walletService, type RechargeMethod } from "@/services/wallet";
import { useRefreshMe } from "@/hooks/useSession";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { formatINR } from "@/lib/money";
import { ApiError, errorMessage } from "@/lib/http";
import { trackEvent } from "@/lib/analytics";
import { TrustNote } from "@/components/shared/TrustNote";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

/**
 * Payment result — the SERVER decides the outcome; this screen only polls and
 * displays. Fires wallet_recharged (client-side) exactly once on success.
 */
export function PaymentResultScreen() {
  const screen = useCurrentScreen();
  const paymentId = screen.params?.paymentId ?? "";
  const refreshMe = useRefreshMe();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => walletService.payment(paymentId),
    enabled: !!paymentId,
    retry: false,
    refetchInterval: (q) => {
      const status = q.state.data?.payment.status;
      return status === "created" || status === "processing" ? 1200 : false;
    },
  });

  const payment = query.data?.payment;
  const status = payment?.status;
  const notFound = query.isError && query.error instanceof ApiError && query.error.status === 404;

  // One-shot success side effects: analytics + cache invalidation.
  const firedRef = useRef(false);
  useEffect(() => {
    if (status === "success" && !firedRef.current) {
      firedRef.current = true;
      trackEvent("wallet_recharged", { amount: payment?.amount ?? 0 });
      refreshMe();
      qc.invalidateQueries({ queryKey: ["wallet"] });
    }
  }, [status, payment?.amount, refreshMe, qc]);

  if (!paymentId) {
    return (
      <Centered>
        <ErrorState title={t("wallet.paymentNotFound")} body={t("wallet.paymentNotFoundBody")} />
      </Centered>
    );
  }

  if (query.isLoading) {
    return (
      <div className="h-full px-4 pt-2">
        <PageSkeleton variant="cards" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Centered>
        <ErrorState
          title={notFound ? t("wallet.paymentNotFound") : t("common.errorGeneric")}
          body={notFound ? t("wallet.paymentNotFoundBody") : errorMessage(query.error)}
          onRetry={notFound ? undefined : () => query.refetch()}
        />
      </Centered>
    );
  }

  if (status === "created" || status === "processing") {
    return <ProcessingView methodLabel={methodLabel(payment?.method)} />;
  }

  if (status === "success") {
    return <SuccessView amount={payment?.amount ?? 0} balance={query.data?.balance} />;
  }

  return <FailedView amount={payment?.amount ?? 0} reason={payment?.failureReason ?? null} method={payment?.method ?? "upi"} />;
}

// ------------------------------------------------------------------ views

function methodLabel(method?: string): string {
  if (method === "card") return t("wallet.methodCard");
  if (method === "netbanking") return t("wallet.methodNetbanking");
  return t("wallet.methodUpi");
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center px-6">{children}</div>;
}

function ProcessingView({ methodLabel: label }: { methodLabel: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 pb-16 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={1.75} />
      </motion.div>
      <h1 className="mt-6 font-display text-[22px] font-semibold tracking-tight">{t("wallet.processing")}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{t("wallet.processingBody")}</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground/80">{label} · demo</p>
      <TrustNote variant="info" className="mt-6 w-full">
        {t("wallet.demoNote")}
      </TrustNote>
    </div>
  );
}

function SuccessView({ amount, balance }: { amount: number; balance?: number }) {
  const backToWallet = useBackToWallet();
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 pb-16 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success/12 text-success"
      >
        <Check className="h-9 w-9" strokeWidth={2.25} />
      </motion.div>
      <h1 className="mt-6 font-display text-[24px] font-semibold tracking-tight">{t("wallet.successTitle")}</h1>
      <p className="mt-2 font-display text-[34px] font-semibold leading-none text-success">{formatINR(amount)}</p>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
        {t("wallet.successBody", { amount: formatINR(amount) })}
      </p>
      {balance != null ? (
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {t("wallet.newBalance")}: <span className="font-semibold text-foreground">{formatINR(balance)}</span>
        </p>
      ) : null}
      <Button
        onClick={backToWallet}
        size="lg"
        className="press mt-8 h-13 w-full max-w-[320px] rounded-full text-[15px] font-semibold"
      >
        {t("wallet.backToWallet")}
      </Button>
    </div>
  );
}

function FailedView({
  amount,
  reason,
  method,
}: {
  amount: number;
  reason: string | null;
  method: string;
}) {
  const backToWallet = useBackToWallet();
  const replace = useAppStore((s) => s.replace);

  const retry = useMutation({
    mutationFn: () => walletService.recharge(amount, method as RechargeMethod),
    onSuccess: (res) => {
      replace({ id: "payment.result", params: { paymentId: res.payment.id } });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 pb-16 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <XCircle className="h-9 w-9" strokeWidth={1.75} />
      </motion.div>
      <h1 className="mt-6 font-display text-[22px] font-semibold tracking-tight">{t("wallet.failedTitle")}</h1>
      <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted-foreground">
        {t("wallet.failedBody")}
      </p>
      {reason ? (
        <p className="mt-3 rounded-xl bg-secondary/70 px-3.5 py-2.5 text-left text-[12.5px] leading-relaxed text-secondary-foreground">
          <span className="font-semibold text-foreground">{t("wallet.failureReasonLabel")}: </span>
          {reason}
        </p>
      ) : null}
      <div className="mt-8 w-full max-w-[320px] space-y-2.5">
        <Button
          onClick={() => retry.mutate()}
          disabled={retry.isPending}
          size="lg"
          className="press h-13 w-full rounded-full text-[15px] font-semibold"
        >
          {retry.isPending ? t("wallet.starting") : t("wallet.retry")}
        </Button>
        <Button
          onClick={backToWallet}
          variant="outline"
          size="lg"
          className="press h-12 w-full rounded-full text-[14px] font-medium"
        >
          {t("wallet.backToWallet")}
        </Button>
      </div>
    </div>
  );
}

/** Pop back to wallet.home — skips the recharge screen when it's beneath us. */
function useBackToWallet() {
  const pop = useAppStore((s) => s.pop);
  const stacks = useAppStore((s) => s.stacks);
  const tab = useAppStore((s) => s.tab);
  return () => {
    const stack = stacks[tab];
    if (stack.length >= 3 && stack[stack.length - 2]?.id === "wallet.recharge") pop();
    pop();
  };
}

export default PaymentResultScreen;
