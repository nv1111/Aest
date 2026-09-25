"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { profileService } from "@/services/profiles";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/http";
import { trackEvent } from "@/lib/analytics";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaceSearch } from "@/features/onboarding/PlaceSearch";
import type { Place } from "@/lib/cities";
import type { BirthProfileDTO } from "@/types/models";
import { cn } from "@/lib/utils";

type Relation = "self" | "partner" | "family" | "other";

const RELATIONS: { value: Relation; labelKey: string }[] = [
  { value: "self", labelKey: "profile.relationSelf" },
  { value: "partner", labelKey: "profile.relationPartner" },
  { value: "family", labelKey: "profile.relationFamily" },
  { value: "other", labelKey: "profile.relationOther" },
];

/**
 * Birth profile editor — create or edit. Mirrors OnboardingFlow's BirthStep
 * (name, DOB, time + accuracy, PlaceSearch) and works standalone from Home's
 * empty state (mode=create).
 */
export function BirthEditScreen() {
  const screen = useCurrentScreen();
  const me = useMe();
  const refreshMe = useRefreshMe();
  const pop = useAppStore((s) => s.pop);

  const editingId = screen.params?.id ?? null;
  const isCreate = !editingId && screen.params?.mode === "create";
  const editing: BirthProfileDTO | null = editingId
    ? (me.data?.profiles.find((p) => p.id === editingId) ?? null)
    : null;

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [accuracy, setAccuracy] = useState<"exact" | "approximate" | "unknown">("exact");
  const [relation, setRelation] = useState<Relation>("self");
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill when editing (or when creating with the user's name available).
  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDob(editing.dateOfBirth);
      setTob(editing.timeOfBirth ?? "");
      setAccuracy(editing.timeAccuracy);
      setRelation((editing.relation as Relation) ?? "self");
      setPlace({
        name: editing.placeName,
        country: editing.placeCountry ?? "India",
        latitude: editing.latitude,
        longitude: editing.longitude,
        timezone: editing.timezone,
      });
    } else if (isCreate && me.data?.user.name) {
      setName(me.data.user.name);
    }
  }, [editing, isCreate, me.data?.user.name]);

  const today = new Date().toISOString().slice(0, 10);
  const valid =
    name.trim().length >= 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    dob <= today &&
    (accuracy === "unknown" || /^([01]\d|2[0-3]):[0-5]\d$/.test(tob)) &&
    place !== null;

  const submit = async () => {
    if (!valid || !place || loading) return;
    setLoading(true);
    try {
      const input = {
        name: name.trim(),
        relation,
        dateOfBirth: dob,
        timeOfBirth: accuracy === "unknown" ? null : tob,
        timeAccuracy: accuracy,
        placeName: place.name,
        placeCountry: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
      };
      if (editing) {
        await profileService.update(editing.id, input);
        toast.success(t("profile.profileSaved"));
      } else {
        await profileService.create(input);
        trackEvent("birth_profile_created", { from: "profile" });
        toast.success(t("profile.profileAdded"));
      }
      await refreshMe();
      pop();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const title = editing ? t("profile.editBirthTitle") : t("profile.addBirthTitle");
  const body = editing ? t("profile.editBirthBody") : t("profile.addBirthBody");

  const accuracyOptions: { value: typeof accuracy; labelKey: string }[] = [
    { value: "exact", labelKey: "onboarding.timeAccuracyExact" },
    { value: "approximate", labelKey: "onboarding.timeAccuracyApproximate" },
    { value: "unknown", labelKey: "onboarding.timeAccuracyUnknown" },
  ];

  return (
    <ScreenScaffold title={title} width="narrow">
      <div className="space-y-5 pt-1">
        <p className="px-1 text-[14px] leading-relaxed text-muted-foreground">{body}</p>

        <div>
          <label htmlFor="birth-name" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthName")}
          </label>
          <Input
            id="birth-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="h-12 rounded-2xl text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="birth-dob" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthDate")}
          </label>
          <Input
            id="birth-dob"
            type="date"
            max={today}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="h-12 rounded-2xl text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="birth-tob" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthTime")}
          </label>
          <Input
            id="birth-tob"
            type="time"
            disabled={accuracy === "unknown"}
            value={tob}
            onChange={(e) => setTob(e.target.value)}
            className="h-12 rounded-2xl text-[15px] disabled:opacity-50"
          />
          <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label="Time accuracy">
            {accuracyOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={accuracy === o.value}
                onClick={() => setAccuracy(o.value)}
                className={`press flex-1 rounded-xl border px-2 py-2 text-[12px] font-medium transition-colors ${
                  accuracy === o.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t(o.labelKey)}
              </button>
            ))}
          </div>
          {accuracy === "unknown" ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {t("onboarding.timeUnknownNote")}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">{t("onboarding.birthTimeHint")}</p>
          )}
        </div>

        <div>
          <label htmlFor="birth-place" className="mb-2 block text-[13px] font-medium text-foreground">
            {t("onboarding.birthPlace")}
          </label>
          <PlaceSearch value={place} onChange={setPlace} />
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium text-foreground">{t("profile.relation")}</label>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("profile.relation")}>
            {RELATIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={relation === r.value}
                onClick={() => setRelation(r.value)}
                className={cn(
                  "press rounded-xl border px-1 py-2 text-[12px] font-medium transition-colors",
                  relation === r.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary"
                )}
              >
                {t(r.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={submit}
            disabled={!valid || loading}
            size="lg"
            className="h-13 w-full rounded-full text-[15px] font-semibold press"
          >
            {loading
              ? t("common.loading")
              : editing
                ? t("profile.saveChanges")
                : t("onboarding.createChart")}
          </Button>
        </div>
      </div>
    </ScreenScaffold>
  );
}

export default BirthEditScreen;
