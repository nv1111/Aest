"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, HeartHandshake, MessagesSquare, MoonStar, Sparkles, Users } from "lucide-react";
import { astrologyFeatureApi, readCompatResult } from "./api";
import { useCurrentScreen, useAppStore } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { t } from "@/i18n";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { Button } from "@/components/ui/button";
import type { CompatibilityResult } from "@/lib/astrology/types";

const RING_SIZE = 148;
const RING_R = 62;
const RING_CIRC = 2 * Math.PI * RING_R;

/** Compatibility result — the trust-heavy screen. Calm, honest, never a verdict. */
export default function CompatibilityResultScreen() {
  const screen = useCurrentScreen();
  const push = useAppStore((s) => s.push);
  const openInTab = useAppStore((s) => s.openInTab);
  const locale = useLocaleStore((s) => s.locale);
  const aId = screen.params?.aId;
  const bId = screen.params?.bId;

  const result = useQuery<CompatibilityResult, Error>({
    // sessionStorage handoff first; server cache makes the fallback POST instant
    queryKey: ["compat", aId, bId, locale],
    queryFn: () => {
      const stored = readCompatResult(locale);
      if (stored && stored.profileA.id === aId && stored.profileB.id === bId) return stored;
      return astrologyFeatureApi.compatibility({ profileAId: aId!, profileBId: bId!, locale });
    },
    enabled: !!aId && !!bId,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  if (!aId || !bId) {
    return (
      <ScreenScaffold title={t("astrology.compatibility")}>
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          onRetry={() => push({ id: "astrology.compatibility" })}
        />
      </ScreenScaffold>
    );
  }

  const data = result.data;
  const isDemo = data?.provider?.mode === "mock";
  const pct = data ? Math.min(1, Math.max(0, data.totalScore / data.maxScore)) : 0;

  return (
    <ScreenScaffold
      title={t("astrology.compatibility")}
      subtitle={data ? t("astrology.compatResultFor", { a: data.profileA.name, b: data.profileB.name }) : undefined}
      right={isDemo ? <DemoDataBadge /> : undefined}
      width="default"
    >
      {result.isLoading ? (
        <PageSkeleton variant="cards" />
      ) : result.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={result.error?.message}
          onRetry={() => result.refetch()}
        />
      ) : data ? (
        <div className="space-y-7 pt-1">
          {/* ------------------------------------------------ score ring */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            aria-label={t("astrology.compatScore")}
            className="tara-hero flex flex-col items-center rounded-3xl border bg-card px-5 py-6"
          >
            <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                role="img"
                aria-label={`${t("astrology.compatScore")}: ${data.totalScore} ${t("astrology.compatOutOf", { max: data.maxScore })}`}
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  className="stroke-border"
                  strokeWidth="9"
                />
                <motion.circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  initial={{ strokeDashoffset: RING_CIRC }}
                  animate={{ strokeDashoffset: RING_CIRC * (1 - pct) }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[34px] font-semibold leading-none text-foreground">
                  {data.totalScore}
                </span>
                <span className="mt-1 text-[12px] text-muted-foreground">
                  {t("astrology.compatOutOf", { max: data.maxScore })}
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-[280px] text-center text-[13.5px] leading-relaxed text-foreground">
              {data.verdict}
            </p>
          </motion.section>

          {/* ------------------------------------------------ eight factors */}
          <section aria-label={t("astrology.compatKootas")}>
            <SectionHeader>{t("astrology.compatKootas")}</SectionHeader>
            <div className="space-y-2.5 md:grid md:grid-cols-2 md:items-start md:gap-2.5 md:space-y-0">
              {data.kootas.map((k) => (
                <div key={k.key} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold text-foreground">{k.name}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{k.meaning}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground">
                      {k.score}/{k.max}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${Math.min(100, (k.score / Math.max(1, k.max)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{k.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ------------------------------------------------ manglik */}
          <section aria-label={t("astrology.compatManglik")}>
            <SectionHeader>{t("astrology.compatManglik")}</SectionHeader>
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-medium text-secondary-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {data.profileA.name}:{" "}
                  <span className="font-semibold text-foreground">
                    {data.manglik.a ? t("astrology.compatManglikYes") : t("astrology.compatManglikNo")}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12px] font-medium text-secondary-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {data.profileB.name}:{" "}
                  <span className="font-semibold text-foreground">
                    {data.manglik.b ? t("astrology.compatManglikYes") : t("astrology.compatManglikNo")}
                  </span>
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{data.manglik.note}</p>
            </div>
          </section>

          {/* ------------------------------------------------ themes */}
          {data.themes.length > 0 ? (
            <section aria-label={t("astrology.compatThemes")}>
              <SectionHeader>{t("astrology.compatThemes")}</SectionHeader>
              <div className="space-y-2.5">
                {data.themes.map((th, i) => (
                  <div key={i} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-center gap-2">
                      {i === 0 ? (
                        <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2} />
                      ) : (
                        <MessagesSquare className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      )}
                      <p className="font-display text-[15px] font-semibold leading-snug text-foreground">{th.title}</p>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{th.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ------------------------------------------------ CTAs */}
          <div className="space-y-2.5">
            <Button
              onClick={() =>
                openInTab("ask", {
                  id: "ask",
                  params: { q: t("astrology.compatAskQuestion", { name: data.profileB.name }) },
                })
              }
              className="h-12 w-full rounded-2xl text-[14.5px] press"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t("astrology.compatUnderstand")}
            </Button>
            <Button
              variant="outline"
              onClick={() => openInTab("astrologers", { id: "astrologers.list" })}
              className="h-12 w-full rounded-2xl text-[14.5px] press"
            >
              <HeartHandshake className="mr-2 h-4 w-4" />
              {t("common.talkToAstrologer")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => push({ id: "astrology.compatibility" })}
              className="h-11 w-full rounded-2xl text-[13px] text-muted-foreground press"
            >
              {t("astrology.checkAnother")}
            </Button>
          </div>

          {/* ------------------------------------------------ disclaimers */}
          <section aria-label={t("common.why")} className="space-y-2.5">
            {data.disclaimers.map((d, i) => (
              <TrustNote key={i} variant="info">
                {d}
              </TrustNote>
            ))}
            <TrustNote variant="privacy">{t("astrology.compatDisclaimerNote")}</TrustNote>
          </section>
        </div>
      ) : null}
    </ScreenScaffold>
  );
}
