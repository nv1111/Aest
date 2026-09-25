"use client";

import { type LucideIcon, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Gift, RotateCcw } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import type { WalletTransactionDTO } from "@/types/models";

/** Type icon for a wallet row — credit in, debit out, promo gift, refund loop. */
export function TransactionIcon({ tx }: { tx: WalletTransactionDTO }) {
  let Icon: LucideIcon;
  if (tx.type === "refund") Icon = RotateCcw;
  else if (tx.type === "promo_credit") Icon = Gift;
  else if (tx.amount > 0) Icon = ArrowDownLeft;
  else if (tx.amount < 0) Icon = ArrowUpRight;
  else Icon = ArrowLeftRight;

  const isCredit = tx.type !== "refund" && tx.amount > 0;
  return (
    <span
      className={cn(
        "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl",
        isCredit ? "bg-success/10 text-success" : "bg-secondary text-foreground/75"
      )}
    >
      <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
    </span>
  );
}

/** Status chip — label first (never color-only). */
export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    success: { label: t("wallet.statusSuccess"), className: "bg-success/10 text-success" },
    pending: { label: t("wallet.statusPending"), className: "bg-warning/15 text-warning-foreground" },
    failed: { label: t("wallet.statusFailed"), className: "bg-destructive/10 text-destructive" },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${entry.className}`}>
      {entry.label}
    </span>
  );
}
