"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Phone, Video, FileText, Receipt, MoonStar, Clock3, Star } from "lucide-react";
import { toast } from "sonner";
import { consultationsService, type ReviewDTO } from "@/services/consultations";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN, formatDuration, formatINR, formatTimeIN } from "@/lib/money";
import { trackEvent } from "@/lib/analytics";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { AstrologerCard } from "@/components/shared/AstrologerCard";
import { TrustNote } from "@/components/shared/TrustNote";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
  const [rateOpen, setRateOpen] = useState(false);

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

  const { consultation: c, messages, review } = query.data;
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

      {/* ----------------------------------------------------------- review */}
      {c.status === "ended" ? (
        <ReviewSection
          consultationId={c.id}
          astrologerName={c.astrologer.displayName}
          review={review}
          open={rateOpen}
          onOpenChange={setRateOpen}
        />
      ) : null}

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

// ------------------------------------------------------------------ review

function Stars({
  value,
  onChange,
  ariaLabel,
  interactive,
}: {
  value: number;
  onChange?: (v: number) => void;
  ariaLabel?: string;
  interactive?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" role={interactive ? "radiogroup" : undefined} aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t("consultation.rateStarsAria", { count: String(n) })}
            onClick={() => onChange?.(n)}
            className="press flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-primary/5"
          >
            <Star
              className={cn(
                "h-6 w-6 transition-all",
                n <= value ? "fill-primary text-primary" : "text-muted-foreground/40"
              )}
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        ) : (
          <Star
            key={n}
            className={cn("h-4 w-4", n <= value ? "fill-primary text-primary" : "text-muted-foreground/40")}
            strokeWidth={1.75}
            aria-hidden
          />
        )
      )}
    </div>
  );
}

function ReviewSection({
  consultationId,
  astrologerName,
  review,
  open,
  onOpenChange,
}: {
  consultationId: string;
  astrologerName: string;
  review: ReviewDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () => consultationsService.submitReview(consultationId, stars, comment),
    onSuccess: () => {
      trackEvent("reading_rated", { stars });
      void queryClient.invalidateQueries({ queryKey: ["consultation", consultationId] });
      // astrologer aggregates changed too
      void queryClient.invalidateQueries({ queryKey: ["astrologer"] });
      toast.success(t("consultation.rateThanks"), {
        description: t("consultation.rateThanksBody", { name: astrologerName }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("consultation.rateFailed"));
    },
  });

  // already rated — show the saved rating
  if (review) {
    return (
      <section className="mt-6" aria-label={t("consultation.rateGiven")}>
        <SectionHeader>{t("consultation.rateGiven")}</SectionHeader>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <Stars value={review.rating} ariaLabel={t("consultation.rateAria", { count: String(review.rating) })} />
            <p className="text-[11.5px] text-muted-foreground">{formatDateIN(review.createdAt, "short")}</p>
          </div>
          {review.text ? (
            <p className="mt-3 border-t border-hairline pt-3 text-[13px] leading-relaxed text-foreground/85">
              {review.text}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  // not rated yet — CTA card + bottom sheet
  return (
    <>
      <section className="mt-6" aria-label={t("consultation.rateCta")}>
        <button
          type="button"
          onClick={() => {
            setStars(0);
            setComment("");
            onOpenChange(true);
          }}
          className="press group flex w-full items-center gap-3.5 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/30"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Star className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-foreground">{t("consultation.rateCta")}</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
              {t("consultation.rateCtaBody", { name: astrologerName })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className="h-3.5 w-3.5 text-muted-foreground/35" strokeWidth={1.75} aria-hidden />
            ))}
          </span>
        </button>
      </section>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-7 pt-5">
          <SheetHeader className="px-0 pb-1 text-left">
            <SheetTitle className="font-display text-[19px] font-semibold">{t("consultation.rateTitle")}</SheetTitle>
            <SheetDescription className="text-[12.5px] leading-snug">
              {t("consultation.rateCtaBody", { name: astrologerName })}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-3 flex flex-col items-center">
            <Stars value={stars} onChange={setStars} interactive />
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">{t("consultation.rateHint")}</p>
          </div>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("consultation.rateCommentPlaceholder")}
            maxLength={500}
            rows={3}
            className="mt-4 resize-none rounded-xl text-[13.5px]"
            aria-label={t("consultation.rateCommentPlaceholder")}
          />

          <SheetFooter className="mt-4 flex-row items-center gap-3 px-0">
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 rounded-full text-[13px] text-muted-foreground"
              onClick={() => onOpenChange(false)}
            >
              {t("consultation.rateSkip")}
            </Button>
            <Button
              type="button"
              className="press h-11 flex-[1.6] rounded-full text-[13.5px] font-semibold"
              disabled={stars < 1 || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? t("consultation.rateSubmitting") : t("consultation.rateSubmit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
