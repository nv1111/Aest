"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MoonStar } from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { useActiveProfileId } from "./useActiveProfile";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { useLocaleStore } from "@/store/locale";
import { signName } from "@/lib/astrology/names";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { HoroscopePeriod, HoroscopeReading } from "@/lib/astrology/types";

const PERIODS: { value: HoroscopePeriod; label: string }[] = [
  { value: "daily", label: t("astrology.daily") },
  { value: "weekly", label: t("astrology.weekly") },
  { value: "monthly", label: t("astrology.monthly") },
  { value: "yearly", label: t("astrology.yearly") },
];

/** Horoscope — period tabs, honest basis disclosure, energy as rhythm not fate. */
export default function HoroscopeScreen() {
  const { profileId, ready } = useActiveProfileId();
  const push = useAppStore((s) => s.push);
  const [period, setPeriod] = useState<HoroscopePeriod>("daily");
  const locale = useLocaleStore((s) => s.locale);

  const horoscope = useQuery<HoroscopeReading>({
    queryKey: ["horoscope", profileId, period, locale],
    queryFn: () => astrologyService.horoscope(profileId!, period, locale),
    enabled: !!profileId,
    staleTime: 15 * 60_000,
    retry: 1,
  });

  if (ready && !profileId) {
    return (
      <ScreenScaffold title={t("astrology.horoscope")}>
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

  const data = horoscope.data;
  const isDemo = data?.provider?.mode === "mock";
  const rating = data ? Math.min(5, Math.max(1, data.rating)) : 0;

  return (
    <ScreenScaffold
      title={t("astrology.horoscope")}
      subtitle={t("astrology.horoscopeSubtitle")}
      right={isDemo ? <DemoDataBadge /> : undefined}
      width="default"
    >
      {horoscope.isLoading || !profileId ? (
        <PageSkeleton variant="cards" />
      ) : horoscope.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(horoscope.error as Error)?.message}
          onRetry={() => horoscope.refetch()}
        />
      ) : data ? (
        <div className="space-y-6 pt-1">
          {/* ------------------------------------------------ period tabs */}
          <Tabs value={period} onValueChange={(v) => setPeriod(v as HoroscopePeriod)}>
            <TabsList className="h-11 w-full rounded-2xl p-1">
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value} className="flex-1 rounded-xl text-[12.5px]">
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* ------------------------------------------------ basis disclosure */}
          <TrustNote variant="info">
            <span className="font-semibold">
              {t("astrology.basisNote")}: {data.basis}
            </span>{" "}
            · {t("astrology.moonSignLabel")}: {signName(data.moonSign, locale)}
          </TrustNote>

          {/* ------------------------------------------------ headline + summary */}
          <motion.section
            key={period}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            aria-label={data.headline}
            className="tara-hero rounded-3xl border bg-card p-5"
          >
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {data.dateLabel}
            </p>
            <h2 className="mt-1.5 font-display text-[22px] font-semibold leading-snug tracking-tight text-foreground">
              {data.headline}
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{data.summary}</p>
          </motion.section>

          {/* ------------------------------------------------ energy */}
          <section aria-label={t("astrology.energyToday")}>
            <SectionHeader>{t("astrology.energyToday")}</SectionHeader>
            <div className="flex items-center gap-4 rounded-2xl border bg-card px-4 py-3.5">
              <div className="flex items-center gap-1.5" role="img" aria-label={`${t("astrology.energyToday")}: ${t(`astrology.energy${rating}`)}`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      i < rating ? "bg-primary" : "bg-border"
                    )}
                  />
                ))}
              </div>
              <p className="text-[13.5px] font-semibold text-foreground">{t(`astrology.energy${rating}`)}</p>
              <p className="ml-auto max-w-[140px] text-right text-[10.5px] leading-snug text-muted-foreground/70">
                {t("astrology.energyCaption")}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------ sections */}
          {data.sections.length > 0 ? (
            <section aria-label={t("astrology.inDetail")}>
              <SectionHeader>{t("astrology.inDetail")}</SectionHeader>
              <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4">
                {data.sections.map((s, i) => (
                  <AccordionItem key={s.title} value={`s-${i}`} className="border-b border-hairline/60 last:border-0">
                    <AccordionTrigger className="min-h-[52px] py-3 text-left font-display text-[15px] font-semibold hover:no-underline">
                      {s.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-[13.5px] leading-relaxed text-muted-foreground">
                      {s.body}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}
        </div>
      ) : null}
    </ScreenScaffold>
  );
}
