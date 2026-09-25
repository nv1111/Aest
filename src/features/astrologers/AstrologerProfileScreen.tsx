"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  MessageCircle,
  Phone,
  Video,
  Star,
  Sparkles,
} from "lucide-react";
import { astrologersService } from "@/services/astrologers";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { trackEvent } from "@/lib/analytics";
import { formatINR, formatDateIN } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { AvailabilityBadge } from "@/components/shared/AstrologerCard";
import { TrustNote } from "@/components/shared/TrustNote";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import type { ConsultationMode } from "@/services/consultations";

/** Astrologer profile — the trust surface before a paid consultation. */

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= Math.round(rating) ? "h-3.5 w-3.5 fill-warning text-warning" : "h-3.5 w-3.5 text-muted-foreground/40"}
          aria-hidden
        />
      ))}
    </span>
  );
}

/**
 * Consultation start buttons — shared by the mobile sticky bar and the
 * desktop side panel so the two stay visually in sync.
 */
function StartActions({
  startable,
  awayHours,
  modes,
  onMode,
  onBook,
}: {
  startable: boolean;
  awayHours: number | null;
  modes: string[];
  onMode: (mode: ConsultationMode) => void;
  onBook: () => void;
}) {
  if (startable) {
    return (
      <div className="flex items-center gap-2">
        {modes.includes("chat") ? (
          <Button className="h-11 flex-1 rounded-full press" onClick={() => onMode("chat")}>
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
            {t("astrologers.startChat")}
          </Button>
        ) : null}
        {modes.includes("audio") ? (
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full bg-secondary/50 press hover:bg-secondary"
            onClick={() => onMode("audio")}
            aria-label={t("astrologers.startAudio")}
          >
            <Phone className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("astrologers.startAudio")}</span>
          </Button>
        ) : null}
        {modes.includes("video") ? (
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full bg-secondary/50 press hover:bg-secondary"
            onClick={() => onMode("video")}
            aria-label={t("astrologers.startVideo")}
          >
            <Video className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t("astrologers.startVideo")}</span>
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="h-11 rounded-full bg-secondary/50 press hover:bg-secondary"
          aria-label={t("astrologers.book")}
          onClick={onBook}
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
          <span className="sr-only">{t("astrologers.book")}</span>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 px-2 py-1">
      <p className="text-center text-[12.5px] font-medium text-muted-foreground">
        {awayHours
          ? t("astrologers.availableIn", { hours: awayHours })
          : t("astrologers.offlineNote")}
      </p>
      <div className="flex items-center gap-2">
        <Button disabled className="h-11 flex-1 rounded-full">
          {t("astrologers.startWhenOnline")}
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-full press"
          aria-label={t("astrologers.book")}
          onClick={onBook}
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
          <span className="sr-only">{t("astrologers.book")}</span>
        </Button>
      </div>
    </div>
  );
}

export default function AstrologerProfileScreen() {
  const screen = useCurrentScreen();
  const id = screen.params?.id;
  const push = useAppStore((s) => s.push);
  const [bookOpen, setBookOpen] = useState(false);

  const query = useQuery({
    queryKey: ["astrologer", id],
    queryFn: () => astrologersService.profile(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data?.astrologer) {
      trackEvent("astrologer_viewed", { id: query.data.astrologer.id });
    }
  }, [query.data?.astrologer]);

  if (!id) {
    return (
      <ScreenScaffold title={t("astrologers.title")}>
        <EmptyState
          icon={Sparkles}
          title={t("astrologers.notFoundTitle")}
          body={t("astrologers.notFoundBody")}
        />
      </ScreenScaffold>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenScaffold title={t("astrologers.title")}>
        <PageSkeleton variant="cards" />
      </ScreenScaffold>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenScaffold title={t("astrologers.title")}>
        <ErrorState
          icon={Sparkles}
          title={query.isError ? t("astrologers.errorTitle") : t("astrologers.notFoundTitle")}
          onRetry={() => query.refetch()}
        />
      </ScreenScaffold>
    );
  }

  const { astrologer: a, reviews } = query.data;
  const modes = a.consultationModes;
  const startable = a.onlineStatus === "online";
  const awayHours =
    a.onlineStatus === "away" && a.availableFrom
      ? Math.max(1, Math.round((new Date(a.availableFrom).getTime() - Date.now()) / 3600000))
      : null;

  const startConsultation = (mode: ConsultationMode) => {
    if (!startable) return;
    push({ id: "consultation.pre", params: { id: a.id, mode } });
  };

  return (
    <ScreenScaffold title={a.displayName} contentClassName="pb-32">
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
        <div className="min-w-0">
      {/* ---------------------------------------------------------- profile */}
      <div className="flex items-start gap-4 pt-1">
        <Avatar className="h-20 w-20 rounded-3xl border">
          <AvatarImage src={a.photoUrl ?? undefined} alt={a.displayName} />
          <AvatarFallback className="rounded-3xl bg-secondary font-display text-[20px] font-semibold text-secondary-foreground">
            {initials(a.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-display text-[21px] font-semibold leading-tight text-foreground">
              {a.displayName}
            </h1>
            {a.isVerified ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={t("astrologers.verifiedNote")} className="shrink-0">
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
                  {t("astrologers.verifiedNote")}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="mt-1">
            <AvailabilityBadge a={a} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
              {a.rating.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {a.reviewCount} {t("astrologers.reviews")}
            </span>
            <span aria-hidden>·</span>
            <span>{t("astrologers.consultationsDone", { count: a.consultationCount })}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ about */}
      <section className="mt-6" aria-label={t("astrologers.about")}>
        <SectionHeader>{t("astrologers.about")}</SectionHeader>
        <p className="text-[13.5px] leading-relaxed text-foreground/90">{a.about}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.expertise.map((e) => (
            <span
              key={e}
              className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-secondary-foreground"
            >
              {e}
            </span>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------- languages & modes */}
      <section className="mt-6" aria-label={t("astrologers.languages")}>
        <SectionHeader>{t("astrologers.languages")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {a.languages.map((l) => (
            <span
              key={l}
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-foreground"
            >
              {l}
            </span>
          ))}
        </div>
        <SectionHeader className="mt-5">{t("astrologers.modes")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {modes.includes("chat") ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-foreground">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {t("astrologers.modeChat")}
            </span>
          ) : null}
          {modes.includes("audio") ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-foreground">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {t("astrologers.modeAudio")}
            </span>
          ) : null}
          {modes.includes("video") ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-foreground">
              <Video className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {t("astrologers.modeVideo")}
            </span>
          ) : null}
        </div>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          {t("astrologers.yearsExperience", { years: a.experienceYears })}
        </p>
      </section>

        </div>
        <div className="min-w-0">
      {/* ---------------------------------------------------------- pricing */}
      <section className="mt-6 lg:mt-0" aria-label={t("consultation.ratePerMinute")}>
        <SectionHeader>{t("consultation.ratePerMinute")}</SectionHeader>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[30px] font-semibold leading-none text-foreground">
              {formatINR(a.pricePerMinute)}
            </span>
            <span className="text-[15px] font-semibold text-muted-foreground">{t("common.perMinute")}</span>
          </div>
          <TrustNote variant="pricing" className="mt-3">
            {t("astrologers.rateNote")}
          </TrustNote>
        </div>
      </section>

          {/* ---------------------------------------- desktop action panel */}
          <div className="hidden rounded-2xl border bg-card p-2.5 shadow-sm lg:sticky lg:top-24 lg:mt-4 lg:block">
            <StartActions
              startable={startable}
              awayHours={awayHours}
              modes={modes}
              onMode={startConsultation}
              onBook={() => setBookOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- reviews */}
      <section className="mt-6" aria-label={t("astrologers.reviews")}>
        <SectionHeader
          action={
            <span className="text-[12px] font-medium text-muted-foreground">
              {t("astrologers.reviewStats", { count: reviews.length, rating: a.rating.toFixed(1) })}
            </span>
          }
        >
          {t("astrologers.reviews")}
        </SectionHeader>
        {reviews.length === 0 ? (
          <p className="rounded-2xl border bg-card p-4 text-[13px] text-muted-foreground">
            {t("astrologers.noReviews")}
          </p>
        ) : (
          <div className="space-y-2.5">
            {reviews.map((r) => (
              <article key={r.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-foreground">{r.authorName}</p>
                  <Stars rating={r.rating} />
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{r.text}</p>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">{formatDateIN(r.createdAt, "short")}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- sticky CTAs */}
      <div className="sticky bottom-3 z-20 mt-6 rounded-2xl border bg-card/95 p-2.5 shadow-lg shadow-black/5 backdrop-blur-md lg:hidden">
        <StartActions
          startable={startable}
          awayHours={awayHours}
          modes={modes}
          onMode={startConsultation}
          onBook={() => setBookOpen(true)}
        />
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="mx-auto max-w-[340px] rounded-3xl md:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-[17px] font-semibold">
              {t("astrologers.bookDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed">
              {t("astrologers.bookDialogBody")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row">
            <Button className="h-11 flex-1 rounded-full press" onClick={() => setBookOpen(false)}>
              {t("astrologers.bookDialogClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScreenScaffold>
  );
}
