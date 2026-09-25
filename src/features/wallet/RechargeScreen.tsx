"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, CreditCard, Landmark, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { walletService, type RechargeMethod } from "@/services/wallet";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { formatINR } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { TrustNote } from "@/components/shared/TrustNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [99, 199, 499, 999];
const POPULAR = 499;

const METHODS: { id: RechargeMethod; icon: typeof Smartphone; labelKey: string; descKey: string }[] = [
  { id: "upi", icon: Smartphone, labelKey: "wallet.methodUpi", descKey: "wallet.methodUpiDesc" },
  { id: "card", icon: CreditCard, labelKey: "wallet.methodCard", descKey: "wallet.methodCardDesc" },
  { id: "netbanking", icon: Landmark, labelKey: "wallet.methodNetbanking", descKey: "wallet.methodNetbankingDesc" },
];

/** Add money — presets, custom amount, demo method cards. Pricing fully visible before paying. */
export function RechargeScreen() {
  const push = useAppStore((s) => s.push);
  const [preset, setPreset] = useState<number | null>(499);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<RechargeMethod>("upi");
  const [simulateFail, setSimulateFail] = useState(false);

  const customAmount = custom.trim() === "" ? null : Number(custom);
  const amount = customAmount ?? preset;
  const valid = amount != null && Number.isInteger(amount) && amount >= 50 && amount <= 25000;

  const mutation = useMutation({
    mutationFn: () => walletService.recharge(amount as number, method, simulateFail),
    onSuccess: (res) => {
      push({ id: "payment.result", params: { paymentId: res.payment.id } });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const pay = () => {
    if (!valid || mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <ScreenScaffold title={t("wallet.addMoneyTitle")} width="narrow">
      <div className="space-y-6 pt-1">
        {/* presets */}
        <section aria-label={t("wallet.presets")}>
          <SectionHeader>{t("wallet.presets")}</SectionHeader>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
            {PRESETS.map((p) => {
              const active = amount === p && customAmount == null;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPreset(p);
                    setCustom("");
                  }}
                  className={cn(
                    "press relative flex h-13 items-center justify-center rounded-2xl border text-[15px] font-semibold transition-colors",
                    active
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                  )}
                >
                  {formatINR(p)}
                  {p === POPULAR ? (
                    <span className="absolute -top-2 right-2.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                      {t("wallet.mostPopular")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* custom amount */}
        <section aria-label={t("wallet.custom")}>
          <SectionHeader>{t("wallet.custom")}</SectionHeader>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted-foreground"
            >
              ₹
            </span>
            <Input
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              placeholder="0"
              aria-label={t("wallet.custom")}
              className="h-12 rounded-2xl pl-8 text-[15px] tabular-nums"
            />
          </div>
          {customAmount != null && !valid ? (
            <p className="mt-2 text-[12.5px] text-destructive">{t("wallet.amountInvalid")}</p>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">{t("wallet.customHint")}</p>
          )}
        </section>

        {/* method */}
        <section aria-label={t("wallet.method")}>
          <SectionHeader>{t("wallet.method")}</SectionHeader>
          {/* stack on mobile; two-across radio cards on md+ */}
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0" role="radiogroup" aria-label={t("wallet.method")}>
            {METHODS.map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "press flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-colors",
                    active ? "border-primary bg-accent/50" : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
                    <m.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{t(m.labelKey)}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{t(m.descKey)}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}
                  >
                    {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <TrustNote variant="info">{t("wallet.demoPayment")}</TrustNote>

        {/* demo lever — deterministic decline so the failure flow is testable */}
        <button
          type="button"
          role="switch"
          aria-checked={simulateFail}
          onClick={() => setSimulateFail((v) => !v)}
          className={cn(
            "press flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors",
            simulateFail ? "border-warning/50 bg-warning/10" : "border-border bg-card hover:bg-secondary"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "relative h-6 w-10.5 shrink-0 rounded-full transition-colors",
              simulateFail ? "bg-warning" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
                simulateFail ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold">{t("wallet.simulateFail")}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
              {t("wallet.simulateFailNote")}
            </span>
          </span>
        </button>

        <div className="pt-1">
          <Button
            onClick={pay}
            disabled={!valid || mutation.isPending}
            size="lg"
            className="h-13 w-full rounded-full text-[15px] font-semibold press"
            aria-label={t("wallet.pay", { amount: valid ? formatINR(amount as number) : "" })}
          >
            {mutation.isPending ? (
              t("wallet.starting")
            ) : (
              <>
                {t("wallet.pay", { amount: valid ? formatINR(amount as number) : "—" })}
              </>
            )}
          </Button>
        </div>
      </div>
    </ScreenScaffold>
  );
}

export default RechargeScreen;
