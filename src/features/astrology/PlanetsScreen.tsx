"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MoonStar } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { PLANET_ABBR, PLANET_GLYPH_CLASS, PLANET_ORDER, planetMeaning } from "./constants";
import { useActiveProfileId } from "./useActiveProfile";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { useLocaleStore } from "@/store/locale";
import { nakshatraName, planetName, signName } from "@/lib/astrology/names";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { cn } from "@/lib/utils";
import type { BirthChart } from "@/lib/astrology/types";

/** Planets — one row per graha, tap to reveal what it represents. */
export default function PlanetsScreen() {
  const { profileId, ready } = useActiveProfileId();
  const push = useAppStore((s) => s.push);
  const [open, setOpen] = useState<string | null>(null);
  const locale = useLocaleStore((s) => s.locale);

  const chart = useQuery<BirthChart>({
    queryKey: ["chart", profileId, locale],
    queryFn: () => astrologyService.chart(profileId!, locale),
    enabled: !!profileId,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  if (ready && !profileId) {
    return (
      <ScreenScaffold title={t("astrology.planets")}>
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

  const planets = (chart.data?.planets ?? []).slice().sort(
    (a, b) => PLANET_ORDER.indexOf(a.planet) - PLANET_ORDER.indexOf(b.planet)
  );
  const isDemo = chart.data?.provider?.mode === "mock";

  return (
    <ScreenScaffold
      title={t("astrology.planets")}
      subtitle={t("astrology.planetsSubtitle")}
      right={isDemo ? <DemoDataBadge /> : undefined}
      width="wide"
    >
      {chart.isLoading || !profileId ? (
        <PageSkeleton variant="list" />
      ) : chart.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(chart.error as Error)?.message}
          onRetry={() => chart.refetch()}
        />
      ) : (
        <div className="space-y-2.5 pt-1 md:grid md:grid-cols-2 md:items-start md:gap-2.5 md:space-y-0 lg:grid-cols-3">
          {planets.map((p) => {
            const expanded = open === p.planet;
            const meaning = planetMeaning(p.planet);
            return (
              <div key={p.planet} className="overflow-hidden rounded-2xl border bg-card">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${planetName(p.planet, locale)} — ${t("astrology.degreeFormat", { sign: signName(p.sign, locale), deg: p.degreeInSign.toFixed(1) })}`}
                  onClick={() => setOpen(expanded ? null : p.planet)}
                  className="press flex min-h-[44px] w-full items-center gap-3 p-4 text-left"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold",
                      PLANET_GLYPH_CLASS[p.planet]
                    )}
                  >
                    {PLANET_ABBR[p.planet]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-foreground">{planetName(p.planet, locale)}</span>
                      {p.isRetrograde ? (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning-foreground">
                          {t("astrology.retrogradeLong")}
                        </span>
                      ) : null}
                      <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                        {t("astrology.houseChip", { house: p.house })}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                      {t("astrology.degreeFormat", { sign: signName(p.sign, locale), deg: p.degreeInSign.toFixed(1) })}
                      {" · "}
                      {nakshatraName(p.nakshatra, locale)} · {t("astrology.pada")} {p.nakshatraPada}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      expanded && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-hairline/60 px-4 pb-4 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {t("astrology.planetMeaningTitle")}
                        </p>
                        <p className="mt-1 font-display text-[15px] font-semibold leading-snug text-foreground">
                          {meaning.title}
                        </p>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{meaning.body}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                            {t("astrology.signLordShort")}: <span className="text-foreground">{planetName(p.signLord, locale)}</span>
                          </span>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                            {t("astrology.nakshatraLordShort")}:{" "}
                            <span className="text-foreground">{planetName(p.nakshatraLord, locale)}</span>
                          </span>
                        </div>
                        {p.isRetrograde ? (
                          <TrustNote variant="info" className="mt-3">
                            {t("astrology.retroNote")}
                          </TrustNote>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </ScreenScaffold>
  );
}
