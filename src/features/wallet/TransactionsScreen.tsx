"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { walletService } from "@/services/wallet";
import { t } from "@/i18n";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { TrustNote } from "@/components/shared/TrustNote";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TransactionRow } from "./WalletScreen";

/** Full wallet ledger — every rupee in and out, with status on every line. */
export function TransactionsScreen() {
  const query = useQuery({
    queryKey: ["wallet", "transactions", 50],
    queryFn: () => walletService.transactions(50),
    staleTime: 30_000,
  });

  return (
    <ScreenScaffold title={t("wallet.transactions")} subtitle={t("wallet.transactionsSub")} width="wide">
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <ErrorState title={t("common.errorGeneric")} onRetry={() => query.refetch()} />
      ) : (query.data?.transactions.length ?? 0) === 0 ? (
        <EmptyState icon={Wallet} title={t("wallet.noTransactions")} body={t("wallet.noTransactionsBody")} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-hairline/70">
            {query.data?.transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
          <TrustNote variant="pricing">{t("wallet.everyLineItemised")}</TrustNote>
        </div>
      )}
    </ScreenScaffold>
  );
}

export default TransactionsScreen;
