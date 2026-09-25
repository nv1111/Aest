"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Phone, Video, Wallet, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { astrologersService } from "@/services/astrologers";
import { consultationsService, type ConsultationMode } from "@/services/consultations";
import { useMe } from "@/hooks/useSession";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { trackEvent } from "@/lib/analytics";
import { ApiError, errorMessage } from "@/lib/http";
import { formatINR } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { AvailabilityBadge } from "@/components/shared/AstrologerCard";
import { TrustNote } from "@/components/shared/TrustNote";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/** Pre-consultation — rate, balance, consent, all visible before a rupee moves. */

const MIN_MINUTES = 3;

const MODE_META: Record<ConsultationMode, { icon: typeof MessageCircle; title: string; body: string }> = {
  chat: { icon: MessageCircle, title: t("consultation.preChat"), body: t("consultation.preChatBody", { name: "" }) },
  audio: { icon: Phone, title: t("consultation.preAudio"), body: t("consultation.preAudioBody") },
  video: { icon: Video, title: t("consultation.preVideo"), body: t("consultation.preVideoBody") },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PreConsultationScreen() {
  const screen = useCurrentScreen();
  const astrologerId = screen.params?.id;
  const mode: ConsultationMode =
    screen.params?.mode === "audio" || screen.params?.mode === "video" ? screen.params.mode : "chat";
  const push = useAppStore((s) => s.push);
  const me = useMe();
  const qc = useQueryClient();

  const [starting, setStarting] = useState(false);

  const query = useQuery({
    queryKey: ["astrologer", astrologerId],
    queryFn: () => astrologersService.profile(astrologerId!),
    enabled: !!astrologerId,
    staleTime: 60_000,
  });

  const startMutation = useMutation({
    mutationFn: () => consultationsService.start(astrologerId!, mode),
    onMutate: () => setStarting(true),
    onSuccess: (data) => {
      trackEvent("consultation_started", { mode });
      void qc.invalidateQueries({ queryKey: ["consultations"] });
      push({ id: "consultation.chat", params: { id: data.consultation.id } });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "insufficient_balance") {
        void qc.invalidateQueries({ queryKey: ["me"] });
      }
      toast.error(errorMessage(err));
      setStarting(false);
    },
    onSettled: () => setStarting(false),
  });

  const a = query.data?.astrologer;
  const balance = me.data?.wallet.balance ?? 0;
  const rate = a?.pricePerMinute ?? 0;
  const minutes = useMemo(() => (rate > 0 ? Math.max(0, Math.floor(balance / rate)) : 0), [balance, rate]);
  const canAfford = rate > 0 && balance >= rate * MIN_MINUTES;

  if (!astrologerId) {
    return (
      <ScreenScaffold title={t("consultation.preTitle")} width="narrow">
        <ErrorState title={t("common.errorGeneric")} />
      </ScreenScaffold>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenScaffold title={t("consultation.preTitle")} width="narrow">
        <PageSkeleton variant="cards" />
      </ScreenScaffold>
    );
  }

  if (query.isError || !a) {
    return (
      <ScreenScaffold title={t("consultation.preTitle")} width="narrow">
        <ErrorState title={t("astrologers.notFoundTitle")} onRetry={() => query.refetch()} />
      </ScreenScaffold>
    );
  }

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;
  const modeBody =
    mode === "chat" ? t("consultation.preChatBody", { name: a.displayName }) : meta.body;

  return (
    <ScreenScaffold title={t("consultation.preTitle")} contentClassName="pb-32" width="narrow">
      {/* ------------------------------------------------------ astrologer */}
      <div className="flex items-center gap-3.5 pt-1">
        <Avatar className="h-14 w-14 rounded-2xl border">
          <AvatarImage src={a.photoUrl ?? undefined} alt={a.displayName} />
          <AvatarFallback className="rounded-2xl bg-secondary font-display text-[16px] font-semibold text-secondary-foreground">
            {initials(a.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{a.displayName}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {a.expertise.slice(0, 2).join(" · ")}
          </p>
          <div className="mt-1">
            <AvailabilityBadge a={a} />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- mode + billing */}
      <section className="mt-6" aria-label={meta.title}>
        <SectionHeader>{meta.title}</SectionHeader>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ModeIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">{meta.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{modeBody}</p>
            </div>
          </div>
          {mode !== "chat" ? (
            <TrustNote className="mt-3">{t("consultation.audioVideoDemoNote")}</TrustNote>
          ) : null}
        </div>
      </section>

      <section className="mt-6" aria-label={t("consultation.ratePerMinute")}>
        <SectionHeader>{t("consultation.ratePerMinute")}</SectionHeader>
        <div className="space-y-2.5 rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[28px] font-semibold leading-none text-foreground">
                {formatINR(rate)}
              </span>
              <span className="text-[13px] font-medium text-muted-foreground">{t("common.perMinute")}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {t("consultation.walletBalance")}:{" "}
              <span className="font-semibold text-foreground">{formatINR(balance)}</span>
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t("consultation.balanceAfter", { minutes })}
          </p>
          <TrustNote variant="pricing">
            {formatINR(rate)}/min from the moment the consultation starts. You&apos;ll see the running
            charge at all times. Ending is one tap.
          </TrustNote>
          {!canAfford ? (
            <div className="rounded-xl bg-warning/10 border border-warning/30 p-3.5">
              <p className="text-[13px] font-medium text-foreground">{t("consultation.topUpNeeded")}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {t("consultation.topUpNeededBody", { amount: formatINR(rate * MIN_MINUTES) })}
              </p>
              <Button
                className="mt-3 h-11 w-full rounded-full press"
                onClick={() => push({ id: "wallet.recharge" })}
              >
                <Wallet className="mr-1.5 h-4 w-4" aria-hidden />
                {t("consultation.topUp")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------- consent */}
      <section className="mt-6" aria-label={t("consultation.consentTitle")}>
        <SectionHeader>{t("consultation.consentTitle")}</SectionHeader>
        <TrustNote variant="privacy" icon={ShieldCheck}>
          {t("consultation.consentBody", { name: a.displayName })}
        </TrustNote>
      </section>

      {/* ----------------------------------------------------------- start */}
      <div className="sticky bottom-3 z-20 mt-6 rounded-2xl border bg-card/95 p-2.5 shadow-lg shadow-black/5 backdrop-blur-md">
        {canAfford ? (
          <Button
            className="h-12 w-full rounded-full text-[15px] press"
            disabled={starting}
            onClick={() => startMutation.mutate()}
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("consultation.starting")}
              </>
            ) : (
              t("consultation.start")
            )}
          </Button>
        ) : (
          <Button
            className="h-12 w-full rounded-full text-[15px] press"
            variant="outline"
            onClick={() => push({ id: "wallet.recharge" })}
          >
            <Wallet className="mr-1.5 h-4 w-4" aria-hidden />
            {t("consultation.topUpNeeded")}
          </Button>
        )}
      </div>
    </ScreenScaffold>
  );
}
