"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, Clock3, HeartHandshake, MapPin, MoonStar, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { astrologyFeatureApi, storeCompatResult, type InlineProfileB } from "./api";
import { Segmented } from "./components/Segmented";
import { PlaceSearch } from "@/features/onboarding/PlaceSearch";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { formatDateIN } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TrustNote } from "@/components/shared/TrustNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Place } from "@/lib/cities";
import type { CompatibilityResult } from "@/lib/astrology/types";

type Accuracy = "exact" | "approximate" | "unknown";

const ACCURACY_OPTIONS: { value: Accuracy; label: string }[] = [
  { value: "exact", label: t("astrology.accuracyExact") },
  { value: "approximate", label: t("astrology.accuracyApproximate") },
  { value: "unknown", label: t("astrology.accuracyUnknown") },
];

/** Compatibility — pick two people (or add the second one inline) and match. */
export default function CompatibilityScreen() {
  const me = useMe();
  const refreshMe = useRefreshMe();
  const push = useAppStore((s) => s.push);

  const profiles = me.data?.profiles ?? [];
  const primaryId = me.data?.primaryProfile?.id;

  const [aId, setAId] = useState<string | undefined>(undefined);
  const [bId, setBId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [time, setTime] = useState("");
  const [accuracy, setAccuracy] = useState<Accuracy>("exact");
  const [place, setPlace] = useState<Place | null>(null);
  const [errors, setErrors] = useState<{ name?: string; dob?: string; time?: string; place?: string }>({});

  const resolvedAId = aId ?? primaryId;
  const others = useMemo(() => profiles.filter((p) => p.id !== resolvedAId), [profiles, resolvedAId]);

  const calculate = useMutation<CompatibilityResult, Error, void>({
    mutationFn: async () => {
      if (bId) {
        return astrologyFeatureApi.compatibility({ profileAId: resolvedAId!, profileBId: bId });
      }
      // inline second person — created server-side by the same POST
      const inline: InlineProfileB = {
        name: name.trim(),
        dateOfBirth: dob,
        timeOfBirth: accuracy === "unknown" ? null : time,
        timeAccuracy: accuracy,
        placeName: place!.name,
        placeCountry: place!.country,
        latitude: place!.latitude,
        longitude: place!.longitude,
        timezone: place!.timezone,
      };
      return astrologyFeatureApi.compatibility({ profileAId: resolvedAId!, profileB: inline });
    },
    onSuccess: (result) => {
      storeCompatResult(result);
      refreshMe(); // profile B may have been created server-side
      push({
        id: "astrology.compatibilityResult",
        params: { aId: result.profileA.id, bId: result.profileB.id },
      });
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });

  const pickB = (id: string) => {
    setBId(id);
    setShowForm(false);
    setErrors({});
  };

  const openForm = () => {
    setBId(null);
    setShowForm(true);
  };

  const submit = () => {
    if (!bId) {
      const next: typeof errors = {};
      if (!name.trim()) next.name = t("astrology.errNameRequired");
      if (!dob) next.dob = t("astrology.errDobRequired");
      if (!place) next.place = t("astrology.errPlaceRequired");
      if (accuracy !== "unknown" && !time) next.time = t("astrology.errTimeRequired");
      setErrors(next);
      if (Object.keys(next).length > 0) return;
    }
    calculate.mutate();
  };

  const canSubmit =
    !!resolvedAId && (bId !== null || (showForm && !!name.trim() && !!dob && !!place && (accuracy === "unknown" || !!time)));

  if (!me.isLoading && profiles.length === 0) {
    return (
      <ScreenScaffold title={t("astrology.checkCompatibility")}>
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
    <ScreenScaffold title={t("astrology.checkCompatibility")} subtitle={t("astrology.compatSubtitle")}>
      <div className="space-y-6 pt-1">
        {/* ------------------------------------------------ person A */}
        <section aria-label={t("astrology.compatPickA")}>
          <SectionHeader>{t("astrology.compatPickA")}</SectionHeader>
          {me.isLoading ? (
            <div className="flex gap-2 overflow-hidden">
              <div className="h-[92px] w-[160px] shrink-0 animate-pulse rounded-2xl bg-secondary" />
            </div>
          ) : (
            <div className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {profiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  name={p.name}
                  place={p.placeName}
                  dob={p.dateOfBirth}
                  isYou={p.id === primaryId}
                  selected={p.id === resolvedAId}
                  onClick={() => {
                    setAId(p.id);
                    if (bId === p.id) setBId(null);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------ person B */}
        <section aria-label={t("astrology.compatPickB")}>
          <SectionHeader>{t("astrology.compatPickB")}</SectionHeader>
          <p className="mb-2.5 px-1 text-[12.5px] text-muted-foreground">{t("astrology.compatPickBHint")}</p>
          <div className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {others.map((p) => (
              <ProfileCard
                key={p.id}
                name={p.name}
                place={p.placeName}
                dob={p.dateOfBirth}
                isYou={false}
                selected={bId === p.id}
                onClick={() => pickB(p.id)}
              />
            ))}
            <button
              type="button"
              onClick={openForm}
              aria-label={t("astrology.compatAddProfile")}
              className={cn(
                "press flex min-h-[44px] w-[160px] shrink-0 flex-col items-start rounded-2xl border border-dashed p-3.5 text-left",
                showForm ? "border-primary bg-accent/25" : "border-border bg-card/60 hover:bg-secondary/50"
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Plus className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="mt-2 text-[13px] font-semibold leading-tight text-foreground">
                {t("astrology.compatAddProfile")}
              </span>
            </button>
          </div>

          {/* ------------------------------------------------ inline form */}
          <AnimatePresence initial={false}>
            {showForm ? (
              <motion.div
                key="form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-4 rounded-2xl border bg-card p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="compat-name">{t("astrology.fieldName")}</Label>
                    <Input
                      id="compat-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("astrology.fieldName")}
                      className="h-12 rounded-2xl"
                      autoComplete="off"
                      maxLength={60}
                    />
                    {errors.name ? <FieldError text={errors.name} /> : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="compat-dob" className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" /> {t("astrology.fieldDob")}
                      </Label>
                      <Input
                        id="compat-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="h-12 rounded-2xl"
                      />
                      {errors.dob ? <FieldError text={errors.dob} /> : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="compat-time" className="flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" /> {t("astrology.fieldTime")}
                      </Label>
                      <Input
                        id="compat-time"
                        type="time"
                        value={time}
                        disabled={accuracy === "unknown"}
                        onChange={(e) => setTime(e.target.value)}
                        className="h-12 rounded-2xl disabled:opacity-50"
                      />
                      {errors.time ? <FieldError text={errors.time} /> : null}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[13px] font-medium text-foreground">{t("astrology.fieldTime")} — accuracy</p>
                    <Segmented<Accuracy>
                      ariaLabel={t("astrology.fieldTime")}
                      size="sm"
                      options={ACCURACY_OPTIONS}
                      value={accuracy}
                      onChange={setAccuracy}
                    />
                    {accuracy === "unknown" ? (
                      <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                        {t("astrology.accuracyUnknownHint")}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="compat-place" className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {t("astrology.fieldPlace")}
                    </Label>
                    <PlaceSearch value={place} onChange={setPlace} />
                    {errors.place ? <FieldError text={errors.place} /> : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* ------------------------------------------------ calculate */}
        <Button
          onClick={submit}
          disabled={!canSubmit || calculate.isPending}
          className="h-12 w-full rounded-2xl text-[15px] press"
        >
          {calculate.isPending ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
              {t("astrology.compatCalculating")}
            </>
          ) : (
            <>
              <HeartHandshake className="mr-2 h-4.5 w-4.5" strokeWidth={1.75} />
              {t("astrology.compatCalculate")}
            </>
          )}
        </Button>

        <TrustNote variant="info">{t("astrology.compatDisclaimer")}</TrustNote>
      </div>
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------- pieces

function FieldError({ text }: { text: string }) {
  return <p className="text-[12px] font-medium text-destructive">{text}</p>;
}

function ProfileCard({
  name,
  place,
  dob,
  isYou,
  selected,
  onClick,
}: {
  name: string;
  place: string;
  dob: string;
  isYou: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${name}, ${place}`}
      className={cn(
        "press flex min-h-[44px] w-[160px] shrink-0 flex-col items-start rounded-2xl border p-3.5 text-left transition-colors",
        selected ? "border-primary bg-accent/25" : "bg-card hover:bg-secondary/50"
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <p className="truncate text-[13.5px] font-semibold text-foreground">{name}</p>
        {isYou ? (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("astrology.compatYou")}
          </span>
        ) : null}
      </div>
      <p className="mt-1 flex w-full items-center gap-1 truncate text-[11.5px] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{place}</span>
      </p>
      <p className="mt-1 flex w-full items-center gap-1 truncate text-[11px] text-muted-foreground/70">
        <CalendarDays className="h-3 w-3 shrink-0" /> {formatDateIN(new Date(`${dob}T12:00:00`))}
      </p>
      {selected ? (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary">
          <Check className="h-3 w-3" /> {t("astrology.compatSelected")}
        </span>
      ) : null}
    </button>
  );
}
