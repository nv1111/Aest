"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Gift, Plus, RotateCcw, Wallet } from "lucide-react";
import { useMe } from "@/hooks/useSession";
import { walletService } from "@/services/wallet";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { formatINR, formatSignedINR, formatDateIN } from "@/lib/money";
import type { WalletTransactionDTO } from "@/types/models";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TrustNote } from "@/components/shared/TrustNote";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusChip, TransactionIcon } from "./TransactionRow";

/** Wallet home — balance, add money, recent ledger. Calm premium, no clutter. */
export function WalletScreen() {
  const me = useMe();
  const push = useAppStore((s) => s.push);

  const recent = useQuery({
    queryKey: ["wallet", "transactions", 3],
    queryFn: () => walletService.transactions(3),
    staleTime: 30_000,
  });

  const balance = me.data?.wallet.balance ?? 0;

  return (
    <ScreenScaffold title={t("wallet.title")} width="wide">
      {/*
       * Mobile: stacked (balance → recent → trust note).
       * lg+: natural two-column dashboard — balance card + trust note aside on
       * the left (340px), recent transactions as the main column on the right.
       * Auto grid placement keeps DOM order identical to the mobile stack.
       */}
      <div className="space-y-6 pt-1 lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6 lg:space-y-0">
        {/* balance card */}
        {me.isLoading ? (
          <Skeleton className="h-40 w-full rounded-3xl" />
        ) : (
          <motion.section
            aria-label={t("wallet.balance")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="tara-hero relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20"
          >
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-primary-foreground/70">
              {t("wallet.balance")}
            </p>
            <p className="mt-1.5 font-display text-[38px] font-semibold leading-none tracking-tight">
              {formatINR(balance)}
            </p>
            <p className="mt-2 text-[12.5px] text-primary-foreground/80">{t("wallet.balanceNote")}</p>
            <Button
              onClick={() => push({ id: "wallet.recharge" })}
              className="press mt-4 h-11 w-full rounded-full bg-primary-foreground text-[14px] font-semibold text-primary hover:bg-primary-foreground/90"
              aria-label={t("wallet.addMoney")}
            >
              <Plus className="mr-1.5 h-4.5 w-4.5" strokeWidth={2} />
              {t("wallet.addMoney")}
            </Button>
          </motion.section>
        )}

        {/* recent transactions */}
        <section aria-label={t("wallet.recent")}>
          <SectionHeader
            action={
              <button
                type="button"
                onClick={() => push({ id: "wallet.transactions" })}
                className="text-[12px] font-medium text-primary press"
              >
                {t("wallet.seeAll")}
              </button>
            }
          >
            {t("wallet.recent")}
          </SectionHeader>

          {recent.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : recent.isError ? (
            <ErrorState onRetry={() => recent.refetch()} title={t("common.errorGeneric")} />
          ) : (recent.data?.transactions.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t("wallet.noTransactions")}
              body={t("wallet.noTransactionsBody")}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-hairline/70">
              {recent.data?.transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </section>

        <TrustNote variant="pricing">{t("wallet.everyLineItemised")}</TrustNote>
      </div>
    </ScreenScaffold>
  );
}

/** One wallet ledger row — shared by WalletScreen and TransactionsScreen. */
export function TransactionRow({ tx }: { tx: WalletTransactionDTO }) {
  const amountColor =
    tx.amount > 0 && tx.status === "success" ? "text-success" : "text-foreground";

  return (
    <div className="flex min-h-16 items-center gap-3.5 px-4 py-3">
      <TransactionIcon tx={tx} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium leading-snug">{tx.description}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {formatDateIN(tx.createdAt, "datetime")}
          {tx.balanceAfter != null ? ` · ${t("wallet.balanceAfter", { amount: formatINR(tx.balanceAfter) })}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-[14px] font-semibold tabular-nums ${amountColor}`}>
          {formatSignedINR(tx.amount)}
        </span>
        <StatusChip status={tx.status} />
      </div>
    </div>
  );
}

export default WalletScreen;
