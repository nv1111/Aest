"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Hourglass, MoonStar } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { useActiveProfileId } from "./useActiveProfile";
import { PLANET_ABBR, PLANET_GLYPH_CLASS } from "./constants";
import { periodProgress, formatDateLocale } from "./utils";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { useLocaleStore } from "@/store/locale";
import { planetName } from "@/lib/astrology/names";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { cn } from "@/lib/utils";
import { DASHA_ORDER, type DashaInfo, type PlanetName } from "@/lib/astrology/types";

/** Dasha — "What phase am I in now?" with the full 120-year timeline. */
export default function DashaScreen() {
  const { profileId, ready } = useActiveProfileId();
  const push = useAppStore((s) => s.push);
  const locale = useLocaleStore((s) => s.locale);

  const dasha = useQuery<DashaInfo>({
    queryKey: ["dasha", profileId, locale],
    queryFn: () => astrologyService.dasha(profileId!, locale),
    enabled: !!profileId,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  if (ready && !profileId) {
    return (
      <ScreenScaffold title={t("astrology.dashaTitle")}>
        <EmptyState
          icon={MoonStar}
          title={t("astrology.hubNoProfileTitle")}
          body={t("astrology.hubNoProfileBody")}
          actionLabel={t("astrology.hubNoProfileCta")}
          onAction={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
        />
      </ScreenScaffold>
    );
  }

  const isDemo = dasha.data?.provider?.mode === "mock";

  return (
    <ScreenScaffold
      title={t("astrology.dashaTitle")}
      subtitle={t("astrology.dashaSubtitle")}
      right={isDemo ? <DemoDataBadge /> : undefined}
      width="default"
    >
      {dasha.isLoading || !profileId ? (
        <PageSkeleton variant="cards" />
      ) : dasha.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(dasha.error as Error)?.message}
          onRetry={() => dasha.refetch()}
        />
      ) : dasha.data ? (
        <div className="space-y-7 pt-1">
          <NowSection data={dasha.data} locale={locale} />

          {/* ------------------------------------------------ timeline strip */}
          <section aria-label={t("astrology.dashaTimeline")}>
            <SectionHeader>{t("astrology.dashaTimeline")}</SectionHeader>
            <div className="rounded-2xl border bg-card p-4">
              <div className="scroll-thin -mx-1 flex items-stretch gap-1.5 overflow-x-auto px-1 pb-1">
                {dasha.data.timeline.map((seg, idx) => {
                  const years = DASHA_ORDER.find((d) => d.lord === seg.lord)?.years ?? 0;
                  const active = seg.isActive;
                  return (
                    <div
                      key={`${seg.lord}-${seg.start}`}
                      style={{ flexGrow: Math.max(years, 8), flexBasis: `${years * 6}px` }}
                      className="flex min-w-[64px] flex-col"
                    >
                      <div className="flex h-6 items-center justify-center">
                        {active ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-primary-foreground">
                            {t("astrology.dashaYouAreHere")}
                          </span>
                        ) : null}
                      </div>
                      <div
                        role={active ? "status" : undefined}
                        aria-label={t("astrology.dashaChipAria", { lord: planetName(seg.lord, locale), years })}
                        className={cn(
                          "relative flex h-[64px] flex-col items-center justify-center overflow-hidden rounded-xl border transition-colors",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/60 text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "font-display text-[17px] font-semibold leading-none",
                            active && "text-primary-foreground"
                          )}
                        >
                          {seg.lord[0]}
                        </span>
                        <span className="mt-1 text-[10px] leading-none">{t("astrology.yearsSpan", { years })}</span>
                        {active ? (
                          <motion.span
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round(seg.progress * 100)}%` }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                            className="absolute inset-y-0 left-0 bg-primary-foreground/25"
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[11.5px] text-muted-foreground/80">
                {t("astrology.dashaTimelineHint")}
              </p>

              {/* current mahadasha details */}
              <div className="mt-3 rounded-2xl bg-secondary/70 px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("astrology.mahadasha")}
                </p>
                <p className="mt-1 font-display text-[16.5px] font-semibold text-foreground">
                  {planetName(dasha.data.current.mahadasha.lord, locale)}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {formatDateLocale(dasha.data.current.mahadasha.start, locale)} — {formatDateLocale(dasha.data.current.mahadasha.end, locale)}
                </p>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{ width: `${Math.round((dasha.data.timeline.find((s) => s.isActive)?.progress ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    {t("astrology.dashaElapsed", { pct: Math.round((dasha.data.timeline.find((s) => s.isActive)?.progress ?? 0) * 100) })}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ antardasha list */}
          <section aria-label={t("astrology.antardashasWithin", { lord: planetName(dasha.data.current.mahadasha.lord, locale) })}>
            <SectionHeader>
              {t("astrology.antardashasWithin", { lord: planetName(dasha.data.current.mahadasha.lord, locale) })}
            </SectionHeader>
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-2 lg:space-y-0">
              {dasha.data.antardashas.map((sub) => (
                <div
                  key={`${sub.lord}-${sub.start}`}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-2xl border border-l-[3px] bg-card px-4 py-3",
                    sub.isActive ? "border-l-primary bg-accent/25" : "border-l-border"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          sub.isActive ? "bg-primary-foreground/20 text-primary-foreground" : PLANET_GLYPH_CLASS[sub.lord]
                        )}
                      >
                        {PLANET_ABBR[sub.lord]}
                      </span>
                      <p className="text-[14px] font-semibold text-foreground">{planetName(sub.lord, locale)}</p>
                      {sub.isActive ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-primary-foreground">
                          {t("astrology.currentChip")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {formatDateLocale(sub.start, locale)} — {formatDateLocale(sub.end, locale)}
                    </p>
                  </div>
                  {sub.parent !== sub.lord ? (
                    <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------- pieces

function NowSection({ data, locale }: { data: DashaInfo; locale: "en" | "hi" }) {
  const asOf = formatDateLocale(data.asOf, locale);
  const antar = data.current.antardasha;
  const antarPct = periodProgress(antar.start, antar.end, data.asOf);

  return (
    <section aria-label={t("astrology.dashaQuestion")}>
      <SectionHeader action={<span className="text-[11px] text-muted-foreground/70">{t("astrology.dashaAsOf", { date: asOf })}</span>}>
        {t("astrology.dashaQuestion")}
      </SectionHeader>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="tara-hero rounded-3xl border bg-card p-5"
      >
        <p className="font-display text-[19px] font-semibold leading-snug text-foreground">
          {data.simpleReading.headline}
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{data.simpleReading.body}</p>
      </motion.div>

      <div className="mt-3 space-y-2">
        <NowCard
          level={t("astrology.mahadasha")}
          lord={planetName(data.current.mahadasha.lord, locale)}
          start={data.current.mahadasha.start}
          end={data.current.mahadasha.end}
          locale={locale}
          glyphPlanet={data.current.mahadasha.lord}
          className="border-l-primary ml-0"
        />
        <NowCard
          level={t("astrology.antardasha")}
          lord={planetName(antar.lord, locale)}
          start={antar.start}
          end={antar.end}
          locale={locale}
          progress={antarPct}
          glyphPlanet={antar.lord}
          className="border-l-primary/60 ml-3"
        />
        {data.current.pratyantardasha ? (
          <NowCard
            level={t("astrology.pratyantardasha")}
            lord={planetName(data.current.pratyantardasha.lord, locale)}
            start={data.current.pratyantardasha.start}
            end={data.current.pratyantardasha.end}
            locale={locale}
            glyphPlanet={data.current.pratyantardasha.lord}
            className="border-l-primary/30 ml-6"
          />
        ) : null}
      </div>
    </section>
  );
}

function NowCard({
  level,
  lord,
  start,
  end,
  locale,
  progress,
  className,
  glyphPlanet,
}: {
  level: string;
  lord: string;
  start: string;
  end: string;
  locale: "en" | "hi";
  progress?: number;
  className?: string;
  glyphPlanet?: PlanetName;
}) {
  return (
    <div className={cn("rounded-2xl border border-l-[3px] bg-card px-4 py-3.5", className)}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{level}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          {glyphPlanet ? (
            <span
              aria-hidden
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold",
                PLANET_GLYPH_CLASS[glyphPlanet]
              )}
            >
              {PLANET_ABBR[glyphPlanet]}
            </span>
          ) : null}
          <span className="truncate font-display text-[18px] font-semibold text-foreground">{lord}</span>
        </span>
        <p className="shrink-0 text-[12px] text-muted-foreground">
          {formatDateLocale(start, locale)} — {formatDateLocale(end, locale)}
        </p>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11.5px] font-medium text-muted-foreground">
            {t("astrology.dashaElapsed", { pct: progress })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
