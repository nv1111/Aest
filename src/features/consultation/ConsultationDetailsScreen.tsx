"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone, Video, FileText, Receipt, MoonStar, Clock3 } from "lucide-react";
import { consultationsService } from "@/services/consultations";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN, formatDuration, formatINR, formatTimeIN } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { AstrologerCard } from "@/components/shared/AstrologerCard";
import { TrustNote } from "@/components/shared/TrustNote";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/** Consultation details — the bill, the summary, the full transcript. */

const MODE_ICON = { chat: MessageCircle, audio: Phone, video: Video } as const;

export default function ConsultationDetailsScreen() {
  const screen = useCurrentScreen();
  const id = screen.params?.id;
  const push = useAppStore((s) => s.push);

  const query = useQuery({
    queryKey: ["consultation", id],
    queryFn: () => consultationsService.get(id!),
    enabled: !!id,
  });

  if (!id) {
    return (
      <ScreenScaffold title={t("consultation.detailsTitle")}>
        <EmptyState icon={MoonStar} title={t("common.errorGeneric")} body={t("consultation.noHistoryBody")} />
      </ScreenScaffold>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenScaffold title={t("consultation.detailsTitle")}>
        <PageSkeleton variant="cards" />
      </ScreenScaffold>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenScaffold title={t("consultation.detailsTitle")}>
        <ErrorState title={t("astrologers.notFoundTitle")} onRetry={() => query.refetch()} />
      </ScreenScaffold>
    );
  }

  const { consultation: c, messages } = query.data;
  const isActive = c.status === "active";
  const ModeIcon = MODE_ICON[(c.mode as keyof typeof MODE_ICON) ?? "chat"] ?? MessageCircle;
  const modeLabel =
    c.mode === "audio" ? t("consultation.modeAudio") : c.mode === "video" ? t("consultation.modeVideo") : t("consultation.modeChat");
  const chatMessages = messages.filter((m) => m.senderRole === "user" || m.senderRole === "astrologer");

  return (
    <ScreenScaffold title={t("consultation.detailsTitle")} contentClassName="pb-32">
      <div className="pt-1">
        <AstrologerCard
          a={c.astrologer}
          onClick={() => push({ id: "astrologers.profile", params: { id: c.astrologer.id } })}
        />
      </div>

      {/* ------------------------------------------------------ bill block */}
      <section className="mt-6" aria-label={t("consultation.amount")}>
        <SectionHeader>{t("consultation.amount")}</SectionHeader>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-[13px] text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <ModeIcon className="h-3.5 w-3.5" aria-hidden />
                {modeLabel}
              </p>
              <p className="mt-1">{formatDateIN(c.startedAt ?? c.createdAt, "datetime")}</p>
              <p className="mt-1">
                {c.totalAmount != null
                  ? t("consultation.billedLine", {
                      duration: formatDuration(c.durationSeconds ?? 0),
                      rate: formatINR(c.ratePerMinute),
                    })
                  : t("consultation.noCharge")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[28px] font-semibold leading-none text-foreground">
                {formatINR(c.totalAmount ?? 0)}
              </p>
              {c.durationSeconds ? (
                <p className="mt-1 text-[12px] text-muted-foreground">{formatDuration(c.durationSeconds)}</p>
              ) : null}
            </div>
          </div>
          {isActive ? (
            <TrustNote className="mt-3">
              {t("consultation.ongoing")} — {formatINR(c.ratePerMinute)}/min. {t("consultation.approxNote")}
            </TrustNote>
          ) : null}
          {c.totalAmount != null && c.totalAmount > 0 ? (
            <button
              type="button"
              onClick={() => push({ id: "wallet.transactions" })}
              className="press mt-3 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
                {t("consultation.walletReference")}
              </span>
              <span className="text-[12px] font-medium text-primary">{t("consultation.viewWallet")}</span>
            </button>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------- summary */}
      <section className="mt-6" aria-label={t("consultation.summary")}>
        <SectionHeader>{t("consultation.summary")}</SectionHeader>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-[13.5px] leading-relaxed text-foreground/90">
            {c.summary ?? t("consultation.noSummary")}
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- transcript */}
      <section className="mt-6" aria-label={t("consultation.transcript")}>
        <SectionHeader>{t("consultation.transcript")}</SectionHeader>
        <Accordion type="single" collapsible>
          <AccordionItem value="transcript" className="rounded-2xl border bg-card px-4">
            <AccordionTrigger className="py-3.5 text-[13.5px] font-medium hover:no-underline">
              {t("consultation.transcriptToggle", { count: chatMessages.length })}
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-3 border-t pt-3">
                {chatMessages.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">{t("consultation.noHistoryBody")}</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="flex gap-2.5">
                      {m.senderRole === "user" ? (
                        <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          {t("consultation.you")}
                        </span>
                      ) : (
                        <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                          {c.astrologer.displayName.split(" ")[0]}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-relaxed text-foreground/90">{m.content}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{formatTimeIN(m.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* ------------------------------------------------------- reports note */}
      <section className="mt-6" aria-label={t("consultation.getReport")}>
        <button
          type="button"
          onClick={() => push({ id: "reports.list" })}
          className="press flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left"
        >
          <span className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-foreground">{t("consultation.getReportCta")}</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">{t("consultation.getReport")}</span>
            </span>
          </span>
        </button>
      </section>

      {/* --------------------------------------------------------- open chat */}
      {isActive ? (
        <div className="sticky bottom-3 z-20 mt-6 rounded-2xl border bg-card/95 p-2.5 shadow-lg shadow-black/5 backdrop-blur-md">
          <Button
            className="h-11 w-full rounded-full press"
            onClick={() => useAppStore.getState().replace({ id: "consultation.chat", params: { id } })}
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
            {t("consultation.continueChat")}
          </Button>
        </div>
      ) : null}

      {isActive ? null : (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          {t("consultation.endedBanner")}
        </p>
      )}
    </ScreenScaffold>
  );
}
