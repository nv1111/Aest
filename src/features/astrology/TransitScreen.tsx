"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MoonStar, RotateCcw, Sparkles } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { PLANET_ABBR, PLANET_GLYPH_CLASS } from "./constants";
import { useActiveProfileId } from "./useActiveProfile";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanetName, TransitEntry, TransitInfo } from "@/lib/astrology/types";

const SLOW: PlanetName[] = ["Saturn", "Jupiter", "Rahu", "Ketu"];
const FAST: PlanetName[] = ["Sun", "Moon", "Mars", "Mercury", "Venus"];

/** Transits — major movers as cards, fast planets as compact rows. */
export default function TransitScreen() {
  const { profileId, ready } = useActiveProfileId();
  const push = useAppStore((s) => s.push);
  const openInTab = useAppStore((s) => s.openInTab);

  const transit = useQuery<TransitInfo>({
    queryKey: ["transit", profileId],
    queryFn: () => astrologyService.transit(profileId!),
    enabled: !!profileId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (ready && !profileId) {
    return (
      <ScreenScaffold title={t("astrology.transit")}>
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

  const byPlanet = new Map((transit.data?.transits ?? []).map((tr) => [tr.planet, tr]));
  const isDemo = transit.data?.provider?.mode === "mock";
  const asOf = transit.data ? formatDateIN(transit.data.asOf) : "";

  const askAbout = (e: TransitEntry) =>
    openInTab("ask", {
      id: "ask",
      params: { q: t("astrology.transitQuestion", { planet: e.planet, house: e.natalHouse }) },
    });

  return (
    <ScreenScaffold
      title={t("astrology.transit")}
      subtitle={asOf ? t("astrology.asOf", { date: asOf }) : t("astrology.transitSubtitle")}
      right={isDemo ? <DemoDataBadge /> : undefined}
    >
      {transit.isLoading || !profileId ? (
        <PageSkeleton variant="cards" />
      ) : transit.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(transit.error as Error)?.message}
          onRetry={() => transit.refetch()}
        />
      ) : transit.data ? (
        <div className="space-y-7 pt-1">
          {/* ------------------------------------------------ major movers */}
          <section aria-label={t("astrology.majorMovers")}>
            <SectionHeader>{t("astrology.majorMovers")}</SectionHeader>
            <p className="mb-3 px-1 text-[13px] leading-relaxed text-muted-foreground">
              {t("astrology.transitTitle")}
            </p>
            <div className="space-y-2.5">
              {SLOW.map((name, i) => {
                const e = byPlanet.get(name);
                if (!e) return null;
                return (
                  <motion.article
                    key={e.planet}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.04, ease: "easeOut" }}
                    className="rounded-2xl border bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold",
                          PLANET_GLYPH_CLASS[e.planet]
                        )}
                      >
                        {PLANET_ABBR[e.planet]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-[15px] font-semibold text-foreground">{e.planet}</p>
                          <span className="text-[12.5px] text-muted-foreground">
                            {t("astrology.transitInSign", { sign: e.currentSign })}
                          </span>
                          <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-semibold text-accent-foreground">
                            {t("astrology.transitHouse", { house: e.natalHouse })}
                          </span>
                          {e.isRetrograde ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning-foreground">
                              <RotateCcw className="h-3 w-3" /> {t("astrology.retrogradeLong")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {t("astrology.transitSince", { date: formatDateIN(e.startedOn), date2: formatDateIN(e.endsOn) })}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{e.interpretation}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => askAbout(e)}
                      className="mt-3.5 h-10 rounded-full px-4 text-[12.5px] press"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      {t("astrology.transitAsk")}
                    </Button>
                  </motion.article>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------ faster planets */}
          <section aria-label={t("astrology.fasterPlanets")}>
            <SectionHeader>{t("astrology.fasterPlanets")}</SectionHeader>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {FAST.map((name) => {
                const e = byPlanet.get(name);
                if (!e) return null;
                return (
                  <button
                    key={e.planet}
                    type="button"
                    onClick={() => askAbout(e)}
                    aria-label={`${e.planet} ${t("astrology.transitInSign", { sign: e.currentSign })}`}
                    className="press flex min-h-[44px] w-full items-center gap-3 border-b border-hairline/60 px-4 py-3 text-left last:border-0 hover:bg-secondary/50"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        PLANET_GLYPH_CLASS[e.planet]
                      )}
                    >
                      {PLANET_ABBR[e.planet]}
                    </span>
                    <span className="text-[13.5px] font-semibold text-foreground">{e.planet}</span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {t("astrology.transitInSign", { sign: e.currentSign })}
                    </span>
                    <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                      {t("astrology.houseChip", { house: e.natalHouse })}
                    </span>
                    <span className="hidden text-[11.5px] text-muted-foreground/80 sm:block">
                      {t("astrology.transitUntil", { date: formatDateIN(e.endsOn) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------ notable */}
          {transit.data.notable.length > 0 ? (
            <section aria-label={t("astrology.transitNotable")}>
              <SectionHeader>{t("astrology.transitNotable")}</SectionHeader>
              <ul className="space-y-2 rounded-2xl border bg-card p-4">
                {transit.data.notable.map((n, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </ScreenScaffold>
  );
}
