"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BadgeCheck, Pencil, Plus, Star, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { profileService } from "@/services/profiles";
import { http } from "@/lib/http";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { BirthProfileDTO } from "@/types/models";
import { cn } from "@/lib/utils";

/** Birth profiles — list with primary badge; tap opens an action sheet. */
export function BirthProfilesScreen() {
  const me = useMe();
  const push = useAppStore((s) => s.push);

  if (me.isLoading) return <PageSkeleton variant="list" />;
  if (me.isError || !me.data) {
    return (
      <ScreenScaffold title={t("profile.birthProfiles")}>
        <EmptyState
          icon={UserRound}
          title={t("common.errorGeneric")}
          body={t("common.errorOffline")}
          actionLabel={t("common.retry")}
          onAction={() => me.refetch()}
        />
      </ScreenScaffold>
    );
  }

  const profiles = me.data.profiles;

  return (
    <ScreenScaffold title={t("profile.birthProfiles")} subtitle={t("profile.birthProfilesSub")}>
      {profiles.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={t("profile.noProfiles")}
          body={t("profile.noProfilesBody")}
          actionLabel={t("profile.addProfile")}
          onAction={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
        />
      ) : (
        <div className="space-y-3">
          {profiles.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <ProfileCard profile={p} />
            </motion.div>
          ))}
        </div>
      )}

      <div className="pt-5">
        <Button
          onClick={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
          className="press h-12 w-full rounded-full text-[14px] font-semibold"
          aria-label={t("profile.addProfile")}
        >
          <Plus className="mr-1.5 h-4.5 w-4.5" strokeWidth={2} />
          {t("profile.addProfile")}
        </Button>
      </div>
    </ScreenScaffold>
  );
}

export default BirthProfilesScreen;

function ProfileCard({ profile }: { profile: BirthProfileDTO }) {
  const push = useAppStore((s) => s.push);
  const refreshMe = useRefreshMe();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setPrimary = useMutation({
    // The PATCH endpoint accepts isPrimary (see /api/profiles/[id]); the shared
    // profileService type predates it, so this one call goes through http directly.
    mutationFn: () => http.patch<BirthProfileDTO>(`/api/profiles/${profile.id}`, { isPrimary: true }),
    onSuccess: async () => {
      toast.success(t("profile.setPrimaryDone"));
      await refreshMe();
      setSheetOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => profileService.remove(profile.id),
    onSuccess: async () => {
      toast.success(t("profile.profileDeleted"));
      await refreshMe();
      setDeleteOpen(false);
      setSheetOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const relationLabel = relationKey(profile.relation);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="press flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/50"
          aria-label={profile.name}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
            <UserRound className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[14.5px] font-semibold">{profile.name}</span>
              {profile.isPrimary ? <PrimaryBadge /> : null}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
              {formatDateIN(profile.dateOfBirth, "long")} · {profile.placeName}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground/80">
              {relationLabel}
              {profile.timeAccuracy === "unknown"
                ? ` · ${t("profile.timeUnknown")}`
                : profile.timeOfBirth
                  ? ` · ${profile.timeOfBirth}`
                  : ""}
            </span>
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="mx-auto max-w-[430px] rounded-t-3xl px-4 pb-6">
        <SheetHeader className="px-0 pb-1">
          <SheetTitle className="text-left font-display text-[18px]">{profile.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-2 space-y-1.5">
          {!profile.isPrimary ? (
            <SheetAction
              icon={BadgeCheck}
              label={t("profile.setPrimary")}
              onClick={() => setPrimary.mutate()}
              disabled={setPrimary.isPending}
            />
          ) : null}
          <SheetAction
            icon={Pencil}
            label={t("profile.editProfile")}
            onClick={() => {
              setSheetOpen(false);
              push({ id: "profile.birthEdit", params: { id: profile.id } });
            }}
          />
          <SheetAction
            icon={Trash2}
            label={t("profile.deleteProfile")}
            destructive
            onClick={() => setDeleteOpen(true)}
          />
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent className="max-w-[360px] rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">{t("profile.deleteProfileConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>{t("profile.deleteProfileBody")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-full">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 press"
              >
                {remove.isPending ? t("common.loading") : t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function PrimaryBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
      <Star className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      {t("profile.primary")}
    </span>
  );
}

function SheetAction({
  icon: Icon,
  label,
  onClick,
  destructive,
  disabled,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press flex min-h-13 w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left hover:bg-secondary",
        destructive ? "text-destructive" : "text-foreground",
        disabled && "opacity-50"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", destructive ? "text-destructive" : "text-foreground/75")} strokeWidth={1.75} />
      <span className="text-[14.5px] font-medium">{label}</span>
    </button>
  );
}

function relationKey(relation: string): string {
  switch (relation) {
    case "partner":
      return t("profile.relationPartner");
    case "family":
      return t("profile.relationFamily");
    case "other":
      return t("profile.relationOther");
    default:
      return t("profile.relationSelf");
  }
}
