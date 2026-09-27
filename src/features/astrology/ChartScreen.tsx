"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MoonStar, CircleHelp } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { useActiveProfileId } from "./useActiveProfile";
import { NorthChart } from "./components/NorthChart";
import { Segmented } from "./components/Segmented";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { useLocaleStore } from "@/store/locale";
import { planetName, signName } from "@/lib/astrology/names";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { HOUSE_THEMES, SIGN_LORDS, SIGN_SANSKRIT, type BirthChart } from "@/lib/astrology/types";

type Variant = "D1" | "D9" | "D10";

/** Kundli chart — North Indian diamond (D1 Rashi / D9 Navamsa), tappable houses. */
export default function ChartScreen() {
  const { profileId, ready } = useActiveProfileId();
  const push = useAppStore((s) => s.push);
  const [variant, setVariant] = useState<Variant>("D1");
  const [activeHouse, setActiveHouse] = useState<number | null>(null);
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
      <ScreenScaffold title={t("astrology.chart")}>
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

  const divisional = chart.data?.divisional.find((d) => d.id === variant);
  const retroPlanets = new Set((chart.data?.planets ?? []).filter((p) => p.isRetrograde).map((p) => p.planet));
  const isDemo = chart.data?.provider?.mode === "mock";

  const activeHouseData = divisional?.houses.find((h) => h.house === activeHouse) ?? null;
  const activeHouseTheme =
    chart.data?.houses.find((h) => h.house === activeHouse)?.theme ??
    HOUSE_THEMES[activeHouse ?? 0];
  const planetsWithDegrees = (names: string[]) =>
    names.map((name) => chart.data?.planets.find((p) => p.planet === name) ?? null);

  return (
    <ScreenScaffold
      title={t("astrology.chart")}
      subtitle={t("astrology.chartSubtitle")}
      right={isDemo ? <DemoDataBadge /> : undefined}
      width="default"
    >
      {chart.isLoading || !profileId ? (
        <PageSkeleton variant="chart" />
      ) : chart.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(chart.error as Error)?.message}
          onRetry={() => chart.refetch()}
        />
      ) : chart.data && divisional ? (
        <div className="space-y-6 pt-1">
          {/* ------------------------- chart panel — centers as a reading column on md+ */}
          <div className="space-y-6 md:mx-auto md:max-w-[560px]">
          {/* ------------------------------------------------ D1 / D9 switch */}
          <Segmented<Variant>
            ariaLabel={t("astrology.chart")}
            value={variant}
            onChange={(v) => {
              setVariant(v);
              setActiveHouse(null);
            }}
            options={[
              { value: "D1", label: t("astrology.d1") },
              { value: "D9", label: t("astrology.d9") },
              { value: "D10", label: t("astrology.d10") },
            ]}
          />

          {/* ------------------------------------------------ the chart */}
          <motion.section
            key={variant}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            aria-label={divisional.name}
          >
            <div className="rounded-3xl border bg-card p-3">
              <NorthChart
                houses={divisional.houses}
                retroPlanets={retroPlanets}
                activeHouse={activeHouse}
                locale={locale}
                onSelectHouse={(h) => setActiveHouse(h)}
              />
            </div>
            <p className="mt-2.5 px-1 text-center text-[12.5px] leading-relaxed text-muted-foreground">
              {divisional.description}
            </p>
            <p className="mt-1.5 px-1 text-center text-[12px] text-muted-foreground/80">
              {t("astrology.tapHouseHint")}
            </p>
          </motion.section>
          </div>

          {/* ------------------------------------------------ legend */}
          <section aria-label={t("astrology.legend")}>
            <SectionHeader>{t("astrology.legend")}</SectionHeader>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-muted-foreground">
                  1
                </span>
                {t("astrology.legendHouse")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground">2</span>
                {t("astrology.legendSign")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full bg-warning/15 px-1.5 py-px text-[10px] font-bold text-warning-foreground">
                  R
                </span>
                {t("astrology.legendRetro")}
              </span>
            </div>
          </section>

          {/* ------------------------------------------------ notes */}
          {chart.data.note ? (
            <TrustNote icon={CircleHelp} variant="info">
              <span className="font-semibold">{t("astrology.timeAccuracyNote")}</span> — {chart.data.note}
            </TrustNote>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------ house detail sheet */}
      <Sheet open={activeHouse !== null} onOpenChange={(open) => !open && setActiveHouse(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[80vh] w-full max-w-[430px] rounded-t-3xl px-5 pb-8 md:max-w-lg">
          {activeHouseData ? (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle className="font-display text-[19px]">
                  {t("astrology.houseTitle", { n: activeHouseData.house })} · {signName(activeHouseData.sign, locale)}
                </SheetTitle>
                <SheetDescription>
                  {locale === "hi" ? signName(activeHouseData.sign, locale) : SIGN_SANSKRIT[activeHouseData.sign]} ·{" "}
                  {t("astrology.signLordLabel")}: {planetName(SIGN_LORDS[activeHouseData.sign], locale)}
                </SheetDescription>
              </SheetHeader>
              <div className="scroll-thin space-y-4 overflow-y-auto px-5 pt-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("astrology.planetsHere")}
                  </p>
                  {activeHouseData.planets.length === 0 ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {t("astrology.emptyHouse")}
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {planetsWithDegrees(activeHouseData.planets).map((p) => (
                        <span
                          key={p?.planet ?? "unknown"}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-[12.5px] font-medium text-foreground"
                        >
                          {p ? planetName(p.planet, locale) : "—"}
                          {p && variant === "D1" ? (
                            <span className="text-muted-foreground">
                              {t("astrology.degreeFormat", { sign: signName(p.sign, locale), deg: p.degreeInSign.toFixed(1) })}
                            </span>
                          ) : null}
                          {p?.isRetrograde ? (
                            <span className="rounded-full bg-warning/15 px-1.5 py-px text-[10px] font-bold text-warning-foreground">
                              {t("astrology.retrograde")}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl bg-secondary/70 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("astrology.houseTheme")}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-foreground">
                    {activeHouseTheme}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </ScreenScaffold>
  );
}
