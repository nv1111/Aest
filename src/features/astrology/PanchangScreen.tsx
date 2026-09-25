"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Ban,
  Check,
  Clock3,
  Info,
  MapPin,
  Minus,
  Moon,
  MoonStar,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";
import { astrologyService } from "@/services/astrology";
import { useActiveProfileId } from "./useActiveProfile";
import { useLocaleStore } from "@/store/locale";
import { planetName } from "@/lib/astrology/names";
import { dateToISO, formatHHMM, isNowInSlot, localDateISO, nowInTimezone } from "./utils";
import { t } from "@/i18n";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { ContentColumn } from "@/components/shared/content-width";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ChoghadiyaSlot, PanchangData, TimeRange } from "@/lib/astrology/types";

type DateMode = "today" | "tomorrow" | "custom";

/** Panchang — the day's timings, honestly labelled and genuinely useful. */
export default function PanchangScreen() {
  const { profileId, ready } = useActiveProfileId();
  const [mode, setMode] = useState<DateMode>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [learnTerm, setLearnTerm] = useState<string | null>(null);
  const locale = useLocaleStore((s) => s.locale);

  const dateStr = useMemo(() => {
    if (mode === "today") return localDateISO();
    if (mode === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return localDateISO(d);
    }
    return customDate ? dateToISO(customDate) : localDateISO();
  }, [mode, customDate]);

  const panchang = useQuery<PanchangData>({
    queryKey: ["panchang", dateStr, profileId ?? "default", locale],
    queryFn: () => astrologyService.panchang(dateStr, profileId, locale),
    enabled: ready,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const data = panchang.data;
  const isDemo = data?.provider?.mode === "mock";
  const isToday = data ? data.date === localDateISO() : false;
  const nowHM = isToday && data ? nowInTimezone(data.location.timezone) : "";

  const inSlot = (s: TimeRange) => {
    if (!nowHM) return false;
    if (s.end < s.start) return nowHM >= s.start || nowHM < s.end; // crosses midnight
    return isNowInSlot(nowHM, s.start, s.end);
  };

  const dateLabel =
    mode === "custom" && customDate
      ? new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" }).format(customDate)
      : mode === "tomorrow"
        ? t("astrology.tomorrow")
        : t("astrology.today");

  return (
    <ScreenScaffold
      title={t("astrology.panchang")}
      subtitle={dateLabel}
      right={isDemo ? <DemoDataBadge /> : undefined}
      width="wide"
    >
      {panchang.isLoading || (ready && !data) ? (
        <PageSkeleton variant="cards" />
      ) : panchang.isError ? (
        <ErrorState
          icon={MoonStar}
          title={t("common.errorGeneric")}
          body={(panchang.error as Error)?.message}
          onRetry={() => panchang.refetch()}
        />
      ) : data ? (
        <div className="space-y-6 pt-1">
          {/* ------------------------------------------------ date control */}
          <div className="flex w-full gap-1 rounded-2xl bg-secondary p-1 md:max-w-md" role="tablist" aria-label={t("astrology.panchang")}>
            <DateButton active={mode === "today"} onClick={() => setMode("today")}>
              {t("astrology.today")}
            </DateButton>
            <DateButton active={mode === "tomorrow"} onClick={() => setMode("tomorrow")}>
              {t("astrology.tomorrow")}
            </DateButton>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <DateButton active={mode === "custom"} onClick={() => setCalendarOpen(true)}>
                  {mode === "custom" && customDate
                    ? new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }).format(customDate)
                    : t("astrology.pickDate")}
                </DateButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(d) => {
                    if (d) {
                      setCustomDate(d);
                      setMode("custom");
                      setCalendarOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* location */}
          <p className="flex items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            {t("astrology.timingsFor", { place: data.location.name })}
          </p>

          {/* ------------------------------------------------ plain summary */}
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
              {t("astrology.panchangTakeaway")}
            </p>
            <p className="mt-1 text-[13.5px] font-medium leading-relaxed text-foreground">{data.simpleSummary}</p>
          </div>
          {!profileId ? (
            <p className="px-1 text-[12px] leading-relaxed text-muted-foreground/80">
              {t("astrology.defaultLocationNote")}
            </p>
          ) : null}

          {/* ------------------------------------------------ sun & moon */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            aria-label={t("astrology.sunrise")}
            className="tara-hero rounded-3xl border bg-card p-5 md:mx-auto md:max-w-2xl xl:max-w-3xl"
          >
            <div className="grid grid-cols-2 gap-4">
              <BigTime icon={Sunrise} label={t("astrology.sunrise")} value={formatHHMM(data.sunrise)} />
              <BigTime icon={Sunset} label={t("astrology.sunset")} value={formatHHMM(data.sunset)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline/60 pt-4">
              <BigTime icon={Moon} label={t("astrology.moonrise")} value={formatHHMM(data.moonrise)} small />
              <BigTime icon={Moon} label={t("astrology.moonset")} value={formatHHMM(data.moonset)} small />
            </div>
          </motion.section>

          {/* ------------------------------------------------ five angas */}
          <section aria-label={t("astrology.panchangFive")}>
            <SectionHeader>{t("astrology.panchangFive")}</SectionHeader>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <AngaCard
                term="tithi"
                label={t("astrology.tithi")}
                value={data.tithi.name}
                sub={`${data.tithi.phase} · ${t("astrology.endsAt", { date: data.tithi.endDate })}`}
                onLearn={() => setLearnTerm("tithi")}
              />
              <AngaCard
                term="nakshatra"
                label={t("astrology.nakshatra")}
                value={data.nakshatra.name}
                sub={`${t("astrology.pada")} ${data.nakshatra.pada} · ${t("astrology.endsAt", { date: data.nakshatra.endDate })}`}
                onLearn={() => setLearnTerm("nakshatra")}
              />
              <AngaCard
                term="yoga"
                label={t("astrology.yoga")}
                value={data.yoga.name}
                sub="—"
                onLearn={() => setLearnTerm("yoga")}
              />
              <AngaCard
                term="karana"
                label={t("astrology.karana")}
                value={data.karana.name}
                sub="—"
                onLearn={() => setLearnTerm("karana")}
              />
              <AngaCard
                term="vara"
                label={t("astrology.vara")}
                value={data.vara.name}
                sub={`${t("astrology.lord")} · ${planetName(data.vara.lord, locale)}`}
                onLearn={() => setLearnTerm("vara")}
              />
            </div>
          </section>

          {/* ------------------------------------------------ time windows */}
          <section aria-label={t("astrology.carefulWindows")}>
            <SectionHeader>{t("astrology.carefulWindows")}</SectionHeader>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <WindowRow
                icon={Clock3}
                name={t("astrology.rahuKaal")}
                range={data.rahuKaal}
                quality="avoid"
                active={inSlot(data.rahuKaal)}
              />
              <WindowRow
                icon={Clock3}
                name={t("astrology.yamaganda")}
                range={data.yamaganda}
                quality="avoid"
                active={inSlot(data.yamaganda)}
              />
              <WindowRow
                icon={Clock3}
                name={t("astrology.gulika")}
                range={data.gulika}
                quality="avoid"
                active={inSlot(data.gulika)}
              />
              <WindowRow
                icon={Sun}
                name={t("astrology.abhijit")}
                range={data.abhijitMuhurat}
                quality="good"
                active={inSlot(data.abhijitMuhurat)}
              />
            </div>
          </section>

          {/* ------------------------------------------------ choghadiya */}
          <section aria-label={t("astrology.choghadiyaTitle")}>
            <ContentColumn width="default">
            <SectionHeader
              action={
                <button
                  type="button"
                  onClick={() => setLearnTerm("choghadiya")}
                  aria-label={`${t("astrology.choghadiyaTitle")} — ${t("astrology.learnMore")}`}
                  className="press flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                >
                  <Info className="h-4 w-4" strokeWidth={1.75} />
                </button>
              }
            >
              {t("astrology.choghadiyaTitle")}
            </SectionHeader>
            <Tabs defaultValue="day">
              <TabsList className="h-11 w-full rounded-2xl p-1">
                <TabsTrigger value="day" className="flex-1 rounded-xl text-[13px]">
                  {t("astrology.choghadiyaDay")}
                </TabsTrigger>
                <TabsTrigger value="night" className="flex-1 rounded-xl text-[13px]">
                  {t("astrology.choghadiyaNight")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="day">
                <SlotGrid slots={data.choghadiya.day} nowHM={nowHM} />
              </TabsContent>
              <TabsContent value="night">
                <SlotGrid slots={data.choghadiya.night} nowHM={nowHM} />
              </TabsContent>
            </Tabs>
            <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-muted-foreground/80">
              {t("astrology.choghadiyaHint")}
            </p>
            </ContentColumn>
          </section>
        </div>
      ) : null}

      {/* ------------------------------------------------ learn-more dialog */}
      <LearnDialog term={learnTerm} data={data} onClose={() => setLearnTerm(null)} />
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------- pieces

function DateButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "press min-h-[44px] flex-1 rounded-xl px-3 py-2.5 text-[13.5px] font-medium leading-none transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function BigTime({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-display font-semibold leading-tight text-foreground",
            small ? "text-[15px]" : "text-[22px]"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function AngaCard({
  label,
  value,
  sub,
  onLearn,
}: {
  term: string;
  label: string;
  value: string;
  sub: string;
  onLearn: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onLearn}
      aria-label={`${label}: ${value}. ${t("astrology.learnMore")}`}
      className="press flex min-h-[44px] flex-col items-start rounded-2xl border bg-card p-3.5 text-left hover:bg-secondary/50"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
      </div>
      <p className="mt-1 font-display text-[15px] font-semibold leading-tight text-foreground">{value}</p>
      {sub && sub !== "—" ? (
        <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{sub}</p>
      ) : null}
    </button>
  );
}

function QualityChip({ quality }: { quality: "good" | "neutral" | "avoid" }) {
  const cfg = {
    good: { icon: Check, chip: "bg-success/15", text: "text-success", label: t("astrology.goodLabel") },
    neutral: { icon: Minus, chip: "bg-secondary", text: "text-muted-foreground", label: t("astrology.neutralLabel") },
    avoid: { icon: Ban, chip: "bg-warning/15", text: "text-warning-foreground", label: t("astrology.avoidLabel") },
  }[quality];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        cfg.chip,
        cfg.text
      )}
    >
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function WindowRow({
  icon: Icon,
  name,
  range,
  quality,
  active,
}: {
  icon: LucideIcon;
  name: string;
  range: TimeRange;
  quality: "good" | "avoid";
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] items-center gap-3 border-b border-hairline/60 px-4 py-3 last:border-0",
        active && quality === "avoid" && "bg-warning/8",
        active && quality === "good" && "bg-success/8"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-foreground">{name}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {formatHHMM(range.start)} – {formatHHMM(range.end)}
          {active ? ` · ${t("astrology.nowLabel")}` : ""}
        </p>
      </div>
      <QualityChip quality={quality} />
    </div>
  );
}

function SlotGrid({ slots, nowHM }: { slots: ChoghadiyaSlot[]; nowHM: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((s) => {
        const isNow = inSlotLocal(s, nowHM);
        return (
          <div
            key={`${s.name}-${s.start}`}
            className={cn(
              "flex min-h-[44px] flex-col items-start rounded-2xl border bg-card p-3",
              isNow && "ring-2 ring-primary"
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <p className="text-[13.5px] font-semibold text-foreground">{s.name}</p>
              {isNow ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-primary-foreground">
                  {t("astrology.nowLabel")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {formatHHMM(s.start)} – {formatHHMM(s.end)}
            </p>
            <div className="mt-2">
              <QualityChip quality={s.quality} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function inSlotLocal(s: TimeRange, nowHM: string): boolean {
  if (!nowHM) return false;
  if (s.end < s.start) return nowHM >= s.start || nowHM < s.end;
  return isNowInSlot(nowHM, s.start, s.end);
}

function LearnDialog({
  term,
  data,
  onClose,
}: {
  term: string | null;
  data: PanchangData | undefined;
  onClose: () => void;
}) {
  const locale = useLocaleStore((s) => s.locale);
  if (!term) return null;
  const termKey = { tithi: "tithi", nakshatra: "nakshatra", yoga: "yoga", karana: "karana", vara: "vara", rahuKaal: "rahuKaal", abhijit: "abhijit", choghadiya: "choghadiya" }[term];
  if (!termKey) return null;

  const label = t(`astrology.${termKey}`);
  const learn = t(`astrology.learn${termKey.charAt(0).toUpperCase()}${termKey.slice(1)}Body`);
  const current =
    termKey === "rahuKaal" && data
      ? `${formatHHMM(data.rahuKaal.start)} – ${formatHHMM(data.rahuKaal.end)}`
      : termKey === "abhijit" && data
        ? `${formatHHMM(data.abhijitMuhurat.start)} – ${formatHHMM(data.abhijitMuhurat.end)}`
        : data
          ? [
              data.tithi.name,
              `${data.nakshatra.name} · ${t("astrology.pada")} ${data.nakshatra.pada}`,
              data.yoga.name,
              data.karana.name,
              `${data.vara.name} · ${t("astrology.lord")} ${planetName(data.vara.lord, locale)}`,
            ][["tithi", "nakshatra", "yoga", "karana", "vara"].indexOf(termKey)] ?? ""
          : "";

  return (
    <Dialog open={!!term} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[19px]">{label}</DialogTitle>
          {current ? <DialogDescription>{current}</DialogDescription> : null}
        </DialogHeader>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{learn}</p>
      </DialogContent>
    </Dialog>
  );
}
