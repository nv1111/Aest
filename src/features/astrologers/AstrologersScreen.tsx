"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, SlidersHorizontal, Users } from "lucide-react";
import { astrologersService } from "@/services/astrologers";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { AstrologerDTO } from "@/types/models";
import { AstrologerCard } from "@/components/shared/AstrologerCard";
import { ContentColumn } from "@/components/shared/content-width";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  useAstrologerFilters,
  filtersToApi,
  activeFilterCount,
  type PriceBucket,
  type RatingFloor,
  type ExperienceFloor,
  type ModeFilter,
} from "./useAstrologerFilters";

/** Marketplace tab root — sections by availability & quality, honest filters. */

const BASE_EXPERTISE = [
  "Vedic Astrology",
  "Kundli",
  "Career",
  "Relationships",
  "Compatibility",
  "Muhurat",
  "Dasha Analysis",
  "Numerology",
  "Health & Wellbeing",
];
const BASE_LANGUAGES = ["English", "Hindi"];

const PRICE_OPTIONS: { value: PriceBucket; label: string }[] = [
  { value: "any", label: t("astrologers.priceAny") },
  { value: "under15", label: t("astrologers.priceUnder15") },
  { value: "r15to20", label: t("astrologers.price15to20") },
  { value: "r20to25", label: t("astrologers.price20to25") },
  { value: "r25plus", label: t("astrologers.price25plus") },
];

const RATING_OPTIONS: { value: RatingFloor; label: string }[] = [
  { value: "any", label: t("astrologers.ratingAny") },
  { value: "4", label: t("astrologers.rating40") },
  { value: "4.5", label: t("astrologers.rating45") },
];

const EXPERIENCE_OPTIONS: { value: ExperienceFloor; label: string }[] = [
  { value: "any", label: t("astrologers.experienceAny") },
  { value: "5", label: t("astrologers.experience5") },
  { value: "10", label: t("astrologers.experience10") },
  { value: "20", label: t("astrologers.experience20") },
];

const MODE_OPTIONS: { value: ModeFilter; label: string }[] = [
  { value: "any", label: t("astrologers.anyMode") },
  { value: "chat", label: t("astrologers.modeChat") },
  { value: "audio", label: t("astrologers.modeAudio") },
  { value: "video", label: t("astrologers.modeVideo") },
];

export default function AstrologersScreen() {
  const push = useAppStore((s) => s.push);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filters = useAstrologerFilters();
  const apiFilters = useMemo(() => filtersToApi(filters), [filters]);
  const activeCount = activeFilterCount(filters);

  const allQuery = useQuery({
    queryKey: ["astrologers", "browse", "all"],
    queryFn: () => astrologersService.list({ limit: 50 }),
    staleTime: 60_000,
  });

  const filteredQuery = useQuery({
    queryKey: ["astrologers", "browse", "filter", apiFilters],
    queryFn: () => astrologersService.list({ ...apiFilters, limit: 50 }),
    enabled: activeCount > 0,
    staleTime: 60_000,
  });

  const openProfile = (a: AstrologerDTO) => {
    trackEvent("astrologer_viewed", { id: a.id });
    push({ id: "astrologers.profile", params: { id: a.id } });
  };

  const expertiseOptions = useMemo(() => {
    const set = new Set(BASE_EXPERTISE);
    for (const a of allQuery.data?.astrologers ?? []) {
      for (const e of a.expertise) set.add(e);
    }
    return Array.from(set);
  }, [allQuery.data]);

  const languageOptions = useMemo(() => {
    const set = new Set(BASE_LANGUAGES);
    for (const a of allQuery.data?.astrologers ?? []) {
      for (const l of a.languages) set.add(l);
    }
    return Array.from(set);
  }, [allQuery.data]);

  // ------------------------------------------------------------ render states
  if (allQuery.isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <Header activeCount={0} onFilter={() => setSheetOpen(true)} />
        <ContentColumn width="wide">
          <PageSkeleton variant="cards" />
        </ContentColumn>
      </div>
    );
  }

  if (allQuery.isError) {
    return (
      <div className="h-full overflow-y-auto">
        <Header activeCount={activeCount} onFilter={() => setSheetOpen(true)} />
        <ContentColumn width="wide">
          <ErrorState
            icon={Users}
            title={t("astrologers.errorTitle")}
            onRetry={() => allQuery.refetch()}
          />
        </ContentColumn>
      </div>
    );
  }

  const all = allQuery.data?.astrologers ?? [];

  // ------------------------------------------------------- filtered browsing
  if (activeCount > 0) {
    const results = filteredQuery.data?.astrologers ?? [];
    return (
      <div className="scroll-thin h-full overflow-y-auto">
        <Header activeCount={activeCount} onFilter={() => setSheetOpen(true)} />
        <div className="space-y-3 px-4 pb-28 pt-1 md:px-6 md:pb-12">
          <ContentColumn width="wide">
          {filteredQuery.isLoading ? (
            <PageSkeleton variant="cards" />
          ) : results.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title={t("astrologers.emptyTitle")}
              body={t("astrologers.emptyBody")}
              actionLabel={t("astrologers.clearFilters")}
              onAction={() => filters.clear()}
            />
          ) : (
            <>
              <p className="px-1 text-[12.5px] text-muted-foreground" aria-live="polite">
                {results.length} {t("astrologers.title").toLowerCase()}
              </p>
              <div className="space-y-2.5 md:grid md:grid-cols-2 md:space-y-0 md:gap-x-3 md:gap-y-2.5 lg:grid-cols-3">
                {results.map((a) => (
                  <AstrologerCard key={a.id} a={a} onClick={() => openProfile(a)} />
                ))}
              </div>
            </>
          )}
          </ContentColumn>
        </div>
        <FilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          expertiseOptions={expertiseOptions}
          languageOptions={languageOptions}
          resultCount={filteredQuery.data?.astrologers?.length}
        />
      </div>
    );
  }

  // -------------------------------------------------------------- sections
  const recommended = all.slice(0, 3);
  const recommendedIds = new Set(recommended.map((a) => a.id));
  const onlineNow = all.filter((a) => a.onlineStatus === "online" && !recommendedIds.has(a.id)).slice(0, 6);
  const soon = all.filter((a) => a.onlineStatus === "away" && a.availableFrom).slice(0, 6);
  const topRated = [...all].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 3);
  const newlyVerified = all
    .filter((a) => a.isVerified)
    .sort((a, b) => a.consultationCount - b.consultationCount)
    .slice(0, 4);

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <Header activeCount={0} onFilter={() => setSheetOpen(true)} />
      <div className="space-y-7 px-4 pb-28 pt-1 md:px-6 md:pb-12">
        <ContentColumn width="wide">
        {all.length === 0 ? (
          <EmptyState icon={Users} title={t("astrologers.errorTitle")} body={t("astrologers.emptyBody")} />
        ) : (
          <>
            {recommended.length > 0 ? (
              <section aria-label={t("astrologers.recommended")}>
                <SectionHeader>{t("astrologers.recommended")}</SectionHeader>
                <div className="space-y-2.5 md:grid md:grid-cols-2 md:space-y-0 md:gap-x-3 md:gap-y-2.5 lg:grid-cols-3">
                  {recommended.map((a) => (
                    <AstrologerCard key={a.id} a={a} onClick={() => openProfile(a)} />
                  ))}
                </div>
              </section>
            ) : null}

            {onlineNow.length > 0 ? (
              <section aria-label={t("astrologers.onlineNow")}>
                <SectionHeader>{t("astrologers.onlineNow")}</SectionHeader>
                <div className="relative -mx-4 md:-mx-6">
                  <div className="scroll-thin flex gap-3 overflow-x-auto px-4 pb-1 md:px-6">
                    {onlineNow.map((a) => (
                      <div key={a.id} className="w-[236px] shrink-0 md:w-[264px] lg:w-[288px]">
                        <AstrologerCard a={a} compact onClick={() => openProfile(a)} />
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
                    aria-hidden
                  />
                </div>
              </section>
            ) : null}

            {soon.length > 0 ? (
              <section aria-label={t("astrologers.availableSoon")}>
                <SectionHeader>{t("astrologers.availableSoon")}</SectionHeader>
                <div className="relative -mx-4 md:-mx-6">
                  <div className="scroll-thin flex gap-3 overflow-x-auto px-4 pb-1 md:px-6">
                    {soon.map((a) => (
                      <div key={a.id} className="w-[236px] shrink-0 md:w-[264px] lg:w-[288px]">
                        <AstrologerCard a={a} compact onClick={() => openProfile(a)} />
                      </div>
                    ))}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
                    aria-hidden
                  />
                </div>
              </section>
            ) : null}

            <section aria-label={t("astrologers.topRated")}>
              <SectionHeader>{t("astrologers.topRated")}</SectionHeader>
              <div className="space-y-2.5 md:grid md:grid-cols-2 md:space-y-0 md:gap-x-3 md:gap-y-2.5 lg:grid-cols-3">
                {topRated.map((a) => (
                  <AstrologerCard key={a.id} a={a} onClick={() => openProfile(a)} />
                ))}
              </div>
            </section>

            {newlyVerified.length > 0 ? (
              <section aria-label={t("astrologers.newVerified")}>
                <SectionHeader>{t("astrologers.newVerified")}</SectionHeader>
                <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
                  {newlyVerified.map((a) => (
                    <div key={a.id} className="w-[236px] shrink-0 md:w-[264px] lg:w-[288px]">
                      <AstrologerCard a={a} compact onClick={() => openProfile(a)} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
        </ContentColumn>
      </div>
      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        expertiseOptions={expertiseOptions}
        languageOptions={languageOptions}
        resultCount={undefined}
      />
    </div>
  );
}

// ------------------------------------------------------------------ header

function Header({ activeCount, onFilter }: { activeCount: number; onFilter: () => void }) {
  const push = useAppStore((s) => s.push);
  return (
    <header className="sticky top-0 z-30 bg-background/92 px-4 pb-3 pt-5 backdrop-blur-md md:px-6">
      <div className="mx-auto flex w-full items-end justify-between gap-3 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            {t("astrologers.title")}
          </h1>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            {t("astrologers.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => push({ id: "consultation.history" })}
            aria-label={t("consultation.history")}
            className="press flex h-11 w-11 items-center justify-center rounded-full border bg-card text-foreground hover:bg-secondary"
          >
            <History className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onFilter}
            aria-label={t("astrologers.filters")}
            className="press relative flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-[13px] font-medium text-foreground hover:bg-secondary"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">{t("astrologers.filters")}</span>
            {activeCount > 0 ? (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold text-primary-foreground"
                aria-label={String(activeCount)}
              >
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ sheet

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press min-h-[36px] rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  expertiseOptions,
  languageOptions,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expertiseOptions: string[];
  languageOptions: string[];
  resultCount: number | undefined;
}) {
  const filters = useAstrologerFilters();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] max-w-[430px] gap-0 overflow-y-auto rounded-t-3xl scroll-thin px-5 pb-5 pt-5 md:max-w-lg"
      >
        <SheetHeader className="space-y-1 px-0 text-left">
          <SheetTitle className="font-display text-[18px] font-semibold">{t("astrologers.filters")}</SheetTitle>
          <SheetDescription className="text-[12.5px] leading-relaxed">
            Tap a chip to filter, tap again to clear.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <FilterGroup label={t("astrologers.expertise")}>
            {expertiseOptions.map((e) => (
              <FilterChip
                key={e}
                label={e}
                active={filters.expertise === e}
                onClick={() => filters.setExpertise(filters.expertise === e ? null : e)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("astrologers.language")}>
            {languageOptions.map((l) => (
              <FilterChip
                key={l}
                label={l}
                active={filters.language === l}
                onClick={() => filters.setLanguage(filters.language === l ? null : l)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("astrologers.price")}>
            {PRICE_OPTIONS.map((p) => (
              <FilterChip
                key={p.value}
                label={p.label}
                active={filters.price === p.value}
                onClick={() => filters.setPrice(p.value)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("astrologers.rating")}>
            {RATING_OPTIONS.map((r) => (
              <FilterChip
                key={r.value}
                label={r.label}
                active={filters.rating === r.value}
                onClick={() => filters.setRating(r.value)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("astrologers.experience")}>
            {EXPERIENCE_OPTIONS.map((e) => (
              <FilterChip
                key={e.value}
                label={e.label}
                active={filters.experience === e.value}
                onClick={() => filters.setExperience(e.value)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label={t("astrologers.mode")}>
            {MODE_OPTIONS.map((m) => (
              <FilterChip
                key={m.value}
                label={m.label}
                active={filters.mode === m.value}
                onClick={() => filters.setMode(m.value)}
              />
            ))}
          </FilterGroup>
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-3 px-0">
          <Button
            variant="ghost"
            className="h-11 rounded-full px-4 text-[13px] text-muted-foreground"
            onClick={() => filters.clear()}
          >
            {t("astrologers.clearFilters")}
          </Button>
          <Button className="h-11 flex-1 rounded-full press" onClick={() => onOpenChange(false)}>
            {resultCount != null
              ? `${t("astrologers.applyFilters")} (${resultCount})`
              : t("astrologers.applyFilters")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
