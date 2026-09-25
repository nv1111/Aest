"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, Sparkles, ArrowRight, Sun, MoonStar, Clock3, Hourglass, ChevronRight, Sunrise, Sunset } from "lucide-react";
import { useMe } from "@/hooks/useSession";
import { astrologyService } from "@/services/astrology";
import { http, errorMessage } from "@/lib/http";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { useLocaleStore } from "@/store/locale";
import { formatINR } from "@/lib/money";
import type { HomeAstrology } from "@/lib/astrology/types";
import type { AstrologerDTO, ConsultationDTO, ReportDTO } from "@/types/models";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { AstrologerCard } from "@/components/shared/AstrologerCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { contentWidthClass } from "@/components/shared/content-width";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPT_KEYS = [
  "home.promptCareer",
  "home.promptPhase",
  "home.promptRelationships",
  "home.promptMonth",
];

/** Home — personalised, calm, never overloaded. */
export function HomeScreen() {
  const me = useMe();
  const push = useAppStore((s) => s.push);
  const openInTab = useAppStore((s) => s.openInTab);
  const locale = useLocaleStore((s) => s.locale);

  const profileId = me.data?.primaryProfile?.id;
  const hasProfile = !!profileId;

  const home = useQuery<HomeAstrology>({
    queryKey: ["home-astrology", profileId, locale],
    queryFn: () => astrologyService.home(profileId!, locale),
    enabled: !!profileId,
    staleTime: 10 * 60_000,
  });

  const astrologers = useQuery<{ astrologers: AstrologerDTO[] }>({
    queryKey: ["astrologers", "online"],
    queryFn: () => http.get("/api/astrologers?section=online&limit=4"),
    staleTime: 2 * 60_000,
    enabled: hasProfile,
  });

  const recentConsultation = useQuery<{ consultations: ConsultationDTO[] }>({
    queryKey: ["consultations-recent"],
    queryFn: () => http.get("/api/consultations?limit=1"),
    enabled: hasProfile,
    retry: false,
    staleTime: 60_000,
  });

  const recentReport = useQuery<{ reports: ReportDTO[] }>({
    queryKey: ["reports-recent"],
    queryFn: () => http.get("/api/reports?limit=1"),
    enabled: hasProfile,
    retry: false,
    staleTime: 60_000,
  });

  const user = me.data?.user;
  const unread = me.data?.unreadCount ?? 0;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("home.goodMorning") : hour < 17 ? t("home.goodAfternoon") : t("home.goodEvening");
  const firstName = (user?.name ?? "").split(" ")[0] || "";

  // ------------------------------------------------- no profile state
  if (!me.isLoading && !hasProfile) {
    return (
      <div className="scroll-thin h-full overflow-y-auto">
        <TopBar greeting={greeting} name={firstName} unread={unread} onBell={() => push({ id: "notifications.center" })} />
        <EmptyState
          icon={MoonStar}
          title={t("home.noProfileTitle")}
          body={t("home.noProfileBody")}
          actionLabel={t("home.noProfileCta")}
          onAction={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
        />
      </div>
    );
  }

  const online = (astrologers.data?.astrologers ?? []).filter((a) => a.onlineStatus === "online");

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <TopBar greeting={greeting} name={firstName} unread={unread} onBell={() => push({ id: "notifications.center" })} />

      <div
        className={cn(
          "mx-auto grid w-full gap-7 px-4 pb-28 md:grid-cols-2 md:px-6 md:pb-12 xl:grid-cols-3",
          contentWidthClass.wide
        )}
      >
        {/* ------------------------------------------------ YOUR DAY */}
        <section aria-label={t("home.yourDay")} className="xl:col-span-2">
          <SectionHeader action={<DemoDataBadge />}>{t("home.yourDay")}</SectionHeader>
          {home.isLoading || !home.data ? (
            <Skeleton className="h-44 w-full rounded-3xl" />
          ) : home.isError ? (
            <DayCardError onRetry={() => home.refetch()} />
          ) : (
            <DayCard data={home.data} />
          )}
        </section>

        {/* ------------------------------------------------ ASK CTA */}
        <section aria-label={t("home.askYourChart")}>
          <button
            type="button"
            onClick={() => openInTab("ask", { id: "ask" })}
            className="press group flex w-full items-center gap-4 rounded-3xl bg-primary p-5 text-left text-primary-foreground shadow-lg shadow-primary/20"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <Sparkles className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[18px] font-semibold leading-tight">
                {t("home.askYourChart")}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-primary-foreground/80">
                {t("home.askYourChartBody")}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>
          <div className="relative -mx-4 mt-3 md:mx-0">
            <div className="scroll-thin flex gap-2 overflow-x-auto px-4 pb-1 md:flex-wrap md:overflow-visible md:px-0">
              {SUGGESTED_PROMPT_KEYS.map((k) => {
                const p = t(k);
                return (
                <button
                  key={p}
                  type="button"
                  onClick={() => openInTab("ask", { id: "ask", params: { q: p } })}
                  className="press whitespace-nowrap rounded-full border bg-card px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-secondary"
                >
                  {p}
                </button>
                );
              })}
            </div>
            {/* fade hint — there is more to the right */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden"
              aria-hidden
            />
          </div>
        </section>

        {/* ------------------------------------------------ TODAY */}
        <section aria-label={t("home.today")}>
          <SectionHeader
            action={
              <button
                type="button"
                onClick={() => push({ id: "astrology.panchang" })}
                className="text-[12px] font-medium text-primary press"
              >
                {t("home.viewFullPanchang")}
              </button>
            }
          >
            {t("home.today")}
          </SectionHeader>
          {home.isLoading || !home.data ? (
            <Skeleton className="h-52 w-full rounded-2xl" />
          ) : (
            <div className="rounded-2xl border bg-card p-4">
              {/* bold key takeaway — the one line that matters today */}
              {home.data.today.choghadiyaNow?.quality === "good" ? (
                <p className="mb-1 border-b border-hairline/60 pb-3 text-[13px] font-semibold leading-snug text-foreground">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" aria-hidden />
                  {t("home.todayHighlightGood", {
                    name: home.data.today.choghadiyaNow.name,
                    time: home.data.today.choghadiyaNow.ends,
                  })}
                </p>
              ) : (
                <p className="mb-1 border-b border-hairline/60 pb-3 text-[13px] font-semibold leading-snug text-foreground">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" aria-hidden />
                  {t("home.todayHighlightRahu", {
                    start: home.data.today.rahuKaal.start,
                    end: home.data.today.rahuKaal.end,
                  })}
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <TodayItem icon={Sun} label={t("home.tithi")} value={home.data.today.tithi} />
                <TodayItem
                  icon={MoonStar}
                  label={t("home.nakshatra")}
                  value={`${home.data.today.nakshatra} · P${home.data.today.nakshatraPada}`}
                />
                <TodayItem
                  icon={Hourglass}
                  label={t("home.rahuKaal")}
                  value={`${home.data.today.rahuKaal.start}–${home.data.today.rahuKaal.end}`}
                  note={t("home.rahuNote")}
                />
                <TodayItem
                  icon={Clock3}
                  label={t("home.choghadiya")}
                  value={
                    home.data.today.choghadiyaNow
                      ? `${home.data.today.choghadiyaNow.name} · ${t("home.untilTime", { time: home.data.today.choghadiyaNow.ends })}`
                      : "—"
                  }
                  note={
                    home.data.today.choghadiyaNow?.quality === "good"
                      ? t("home.goodPeriodNote")
                      : home.data.today.choghadiyaNow?.quality === "avoid"
                        ? t("home.avoidPeriodNote")
                        : home.data.today.choghadiyaNow
                          ? t("home.neutralPeriodNote")
                          : undefined
                  }
                />
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------ YOUR ASTROLOGY */}
        <section aria-label={t("home.yourAstrology")}>
          <SectionHeader>
            {t("home.yourAstrology")}
          </SectionHeader>
          {home.isLoading || !home.data ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (
            <div className="grid gap-2.5">
              <button
                type="button"
                onClick={() => push({ id: "astrology.dasha" })}
                className="press flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("home.currentPhase")}
                  </p>
                  <p className="mt-1 truncate text-[14.5px] font-semibold">{home.data.dasha.line}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{home.data.dasha.sub}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
              {home.data.transit.line ? (
                <button
                  type="button"
                  onClick={() => push({ id: "astrology.transit" })}
                  className="press flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("home.keyTransit")}
                    </p>
                    <p className="mt-1 text-[14.5px] font-medium leading-snug">{home.data.transit.line}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              ) : null}
            </div>
          )}
        </section>

        {/* ------------------------------------------------ ASTROLOGERS */}
        <section aria-label={t("home.astrologersOnline")} className="md:col-span-2 xl:col-span-3">
          <SectionHeader
            action={
              <button
                type="button"
                onClick={() => openInTab("astrologers", { id: "astrologers.list" })}
                className="text-[12px] font-medium text-primary press"
              >
                {t("common.seeAll")}
              </button>
            }
          >
            {t("home.astrologersOnline")}
          </SectionHeader>
          {astrologers.isLoading ? (
            <div className="grid gap-2.5 md:grid-cols-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : online.length === 0 ? (
            <p className="rounded-2xl border bg-card p-4 text-[13px] text-muted-foreground">
              Astrologers will appear here when they come online.
            </p>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {online.slice(0, 3).map((a) => (
                <AstrologerCard
                  key={a.id}
                  a={a}
                  onClick={() => push({ id: "astrologers.profile", params: { id: a.id } })}
                />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------ RECENT */}
        {recentConsultation.data?.consultations?.length || recentReport.data?.reports?.length ? (
          <section aria-label={t("home.recent")}>
            <SectionHeader>{t("home.recent")}</SectionHeader>
            <div className="space-y-2.5">
              {recentConsultation.data?.consultations?.[0] ? (
                <RecentRow
                  title={t("home.recentConsultation")}
                  value={recentConsultation.data.consultations[0].astrologer.displayName}
                  sub={
                    recentConsultation.data.consultations[0].totalAmount != null
                      ? formatINR(recentConsultation.data.consultations[0].totalAmount)
                      : "Active"
                  }
                  onClick={() => push({ id: "consultation.details", params: { id: recentConsultation.data!.consultations[0].id } })}
                />
              ) : null}
              {recentReport.data?.reports?.[0] ? (
                <RecentRow
                  title={t("home.recentReport")}
                  value={recentReport.data.reports[0].title}
                  sub={t(`reports.ready`)}
                  onClick={() => push({ id: "reports.details", params: { id: recentReport.data!.reports[0].id } })}
                />
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function TopBar({
  greeting,
  name,
  unread,
  onBell,
}: {
  greeting: string;
  name: string;
  unread: number;
  onBell: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-background/92 px-4 pb-3 pt-5 backdrop-blur-md md:px-6">
      <div className={cn("mx-auto flex w-full items-center justify-between gap-3", contentWidthClass.wide)}>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground/75">{greeting}</p>
          <h1 className="truncate font-display text-[22px] font-semibold leading-tight tracking-tight">
            {name || "Welcome"}
          </h1>
        </div>
        <button
          type="button"
          onClick={onBell}
          aria-label={t("home.unreadNotifications")}
          className="press relative flex h-11 w-11 items-center justify-center rounded-full border bg-card text-foreground hover:bg-secondary"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}

function DayCard({ data }: { data: HomeAstrology }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="tara-hero relative overflow-hidden rounded-3xl border bg-card p-5 md:p-6"
    >
      <div className="md:grid md:grid-cols-[1.35fr_1fr] md:gap-8">
        <div>
          <p className="font-display text-[19px] font-semibold leading-snug tracking-tight">
            {data.insight.headline}
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{data.insight.body}</p>
          {/* desktop detail — the day's light window, one calm line */}
          <div className="mt-5 hidden items-center gap-4 border-t border-hairline/60 pt-4 text-[12px] text-muted-foreground md:flex">
            <span className="flex items-center gap-1.5">
              <Sunrise className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} aria-hidden />
              {t("home.sunrise")} <span className="font-semibold text-foreground">{data.today.sunrise}</span>
            </span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-hairline" />
            <span className="flex items-center gap-1.5">
              <Sunset className="h-3.5 w-3.5 text-primary/70" strokeWidth={1.75} aria-hidden />
              {t("home.sunset")} <span className="font-semibold text-foreground">{data.today.sunset}</span>
            </span>
          </div>
        </div>
        {/* factors — wrapped pills on mobile (unchanged), stacked rows on md+ */}
        <div className="mt-5 flex flex-wrap gap-2 md:mt-0 md:content-start md:border-l md:border-hairline/60 md:pl-6">
          {data.insight.factors.map((f) => (
            <span
              key={f.label}
              className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium leading-none text-secondary-foreground md:hidden"
            >
              {f.label}: <span className="font-semibold text-foreground">{f.value}</span>
            </span>
          ))}
          <div className="hidden w-full md:block">
            {data.insight.factors.map((f) => (
              <div key={f.label} className="border-b border-hairline/60 py-2.5 last:border-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{f.label}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-foreground">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DayCardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border bg-card p-5">
      <p className="text-[14px] font-medium">We couldn&apos;t load your day</p>
      <p className="mt-1 text-[13px] text-muted-foreground">Please check your connection and try again.</p>
      <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

function TodayItem({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-hairline/60 py-3.5 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-[13.5px] font-medium text-foreground">{value}</p>
        {note ? <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground/80">{note}</p> : null}
      </div>
    </div>
  );
}

function RecentRow({
  title,
  value,
  sub,
  onClick,
}: {
  title: string;
  value: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("press flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left")}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        <p className="mt-1 truncate text-[14px] font-medium">{value}</p>
      </div>
      <span className="shrink-0 text-[12.5px] text-muted-foreground">{sub}</span>
    </button>
  );
}
