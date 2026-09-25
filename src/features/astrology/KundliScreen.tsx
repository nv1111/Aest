"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Moon, MoonStar, Sparkles, Sun, Sunrise, Clock3 } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { useActiveProfileId } from "./useActiveProfile";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { trackEvent } from "@/lib/analytics";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BirthChart } from "@/lib/astrology/types";

/** Kundli overview — core placements, plain-language highlights, planet summary. */
export default function KundliScreen() {
  const { profileId, ready } = useActiveProfileId();
  const push = useAppStore((s) => s.push);

  const chart = useQuery<BirthChart>({
    queryKey: ["chart", profileId],
    queryFn: () => astrologyService.chart(profileId!),
    enabled: !!profileId,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const tracked = useRef(false);
  useEffect(() => {
    if (profileId && !tracked.current) {
      tracked.current = true;
      trackEvent("kundli_viewed", { source: "astrology" });
    }
  }, [profileId]);

  const isDemo = chart.data?.provider?.mode === "mock";

  if (ready && !profileId) {
    return (
      <ScreenScaffold title={t("astrology.kundli")}>
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

  return (
    <ScreenScaffold title={t("astrology.kundli")} subtitle={t("astrology.kundliSubtitle")}>
      {chart.isLoading || !profileId ? (
        <PageSkeleton variant="cards" />
      ) : chart.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(chart.error as Error)?.message}
          onRetry={() => chart.refetch()}
        />
      ) : chart.data ? (
        <div className="space-y-7 pt-1">
          {/* ------------------------------------------------ core placements */}
          <section aria-label={t("astrology.overview")}>
            <SectionHeader action={isDemo ? <DemoDataBadge /> : undefined}>
              {t("astrology.overview")}
            </SectionHeader>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="tara-hero rounded-3xl border bg-card p-5"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Placement
                  icon={Sunrise}
                  label={t("astrology.lagna")}
                  value={chart.data.ascendant.sign}
                  sub={`${t("astrology.lord")} · ${chart.data.ascendant.lord}${
                    chart.data.ascendant.isApproximate ? ` · ${t("astrology.lagnaApprox")}` : ""
                  }`}
                />
                <Placement
                  icon={Moon}
                  label={t("astrology.rashi")}
                  value={chart.data.moonSign.sign}
                  sub={chart.data.moonSign.sanskrit}
                />
                <Placement
                  icon={MoonStar}
                  label={t("astrology.nakshatra")}
                  value={chart.data.nakshatra.name}
                  sub={`${t("astrology.pada")} ${chart.data.nakshatra.pada} · ${t("astrology.lord")} ${chart.data.nakshatra.lord}`}
                />
                <Placement
                  icon={Sun}
                  label={t("astrology.sunSign")}
                  value={chart.data.sunSign.sign}
                  sub={chart.data.sunSign.sanskrit}
                />
              </div>
            </motion.div>
          </section>

          {/* ------------------------------------------------ highlights */}
          {chart.data.keyHighlights.length > 0 ? (
            <section aria-label={t("astrology.highlights")}>
              <SectionHeader>{t("astrology.highlights")}</SectionHeader>
              <div className="space-y-2.5">
                {chart.data.keyHighlights.map((h, i) => (
                  <motion.div
                    key={h.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.04, ease: "easeOut" }}
                    className="rounded-2xl border bg-card p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                      <p className="font-display text-[15.5px] font-semibold leading-snug text-foreground">
                        {h.title}
                      </p>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{h.body}</p>
                  </motion.div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ------------------------------------------------ planets summary */}
          <section aria-label={t("astrology.planetarySummary")}>
            <SectionHeader>{t("astrology.planetarySummary")}</SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              {chart.data.planets.map((p) => (
                <button
                  key={p.planet}
                  type="button"
                  onClick={() => push({ id: "astrology.planets" })}
                  aria-label={`${p.planet}, ${t("astrology.degreeFormat", { sign: p.sign, deg: p.degreeInSign.toFixed(1) })}`}
                  className="press flex min-h-[44px] flex-col items-start rounded-2xl border bg-card px-3.5 py-3 text-left hover:bg-secondary/50"
                >
                  <div className="flex w-full items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-foreground">{p.planet}</span>
                    {p.isRetrograde ? (
                      <span className="rounded-full bg-warning/15 px-1.5 py-px text-[10px] font-bold text-warning-foreground">
                        {t("astrology.retrograde")}
                      </span>
                    ) : null}
                    <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {t("astrology.houseChip", { house: p.house })}
                    </span>
                  </div>
                  <span className="mt-1 text-[12.5px] text-muted-foreground">
                    {t("astrology.degreeFormat", { sign: p.sign, deg: p.degreeInSign.toFixed(1) })}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ------------------------------------------------ time accuracy note */}
          {chart.data.note ? (
            <TrustNote icon={Clock3} variant="info">
              <span className="font-semibold">{t("astrology.timeAccuracyNote")}</span> — {chart.data.note}
            </TrustNote>
          ) : null}

          {/* ------------------------------------------------ CTAs */}
          <div className="flex gap-2.5">
            <Button
              onClick={() => push({ id: "astrology.chart", params: profileId ? { profileId } : undefined })}
              className="h-12 flex-1 rounded-2xl text-[14.5px] press"
            >
              {t("astrology.viewChart")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => push({ id: "astrology.planets", params: profileId ? { profileId } : undefined })}
              className="h-12 flex-1 rounded-2xl text-[14.5px] press"
            >
              {t("astrology.viewPlanets")}
            </Button>
          </div>
        </div>
      ) : null}
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------- pieces

function Placement({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate font-display text-[16px] font-semibold leading-tight text-foreground">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
