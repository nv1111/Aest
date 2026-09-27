"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Check,
  ChevronRight,
  CircleUser,
  HelpCircle,
  Languages,
  LifeBuoy,
  Lock,
  LogOut,
  MessageSquare,
  Wallet,
  Pencil,
  ScrollText,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useMe, useRefreshMe, useSignOut } from "@/hooks/useSession";
import { userService } from "@/services/user";
import { authService } from "@/services/auth";
import { useAppStore } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { t, LOCALES } from "@/i18n";
import { formatDateIN, formatINR } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ListGroup, ListRow } from "./ListRow";

/** Profile — tab root. Custom header (avatar, name, phone, member since), grouped rows. */
export function ProfileScreen() {
  const me = useMe();
  const push = useAppStore((s) => s.push);

  if (me.isLoading) {
    return <PageSkeleton variant="list" />;
  }
  if (me.isError || !me.data?.user) {
    return (
      <div className="px-4 pt-8 md:px-6">
        <ErrorState title={t("common.errorGeneric")} onRetry={() => me.refetch()} />
      </div>
    );
  }

  const { user, profiles, wallet } = me.data;
  const initials = initialsOf(user.name);
  const phone = user.phone ? `+91 ${user.phone.slice(0, 5)} ${user.phone.slice(5)}` : "—";

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      {/* ------------------------------------------------ header (no back — tab root) */}
      {/* Responsive: header inner centers in the "default" content column on md+ (mirrors ScreenHeader). */}
      <header className="sticky top-0 z-30 bg-background/92 px-4 pb-4 pt-5 backdrop-blur-md md:px-6">
        <div className="mx-auto w-full md:max-w-2xl xl:max-w-3xl">
          <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">{t("profile.title")}</h1>
          <div className="mt-3 flex items-center gap-3.5">
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[20px] font-semibold text-primary-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold leading-snug">{user.name ?? "—"}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">{phone}</p>
              <p className="truncate text-[11.5px] text-muted-foreground/80">
                {t("profile.memberSince", { date: formatDateIN(user.createdAt) })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Responsive: content centers in the "default" column on md+ (mirrors ContentColumn); mobile column is untouched. */}
      <div className="space-y-6 px-4 pb-28 md:px-6 md:pb-12">
        <div className="mx-auto w-full space-y-6 md:max-w-2xl xl:max-w-3xl">
        {/* ------------------------------------------------ wallet */}
        <section aria-label={t("wallet.title")}>
          <button
            type="button"
            onClick={() => push({ id: "wallet.home" })}
            className="press flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Wallet className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[14.5px] font-semibold">{t("wallet.title")}</p>
                <p className="text-[12px] text-muted-foreground">{t("wallet.balance")}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-[20px] font-semibold text-primary">{formatINR(wallet.balance)}</p>
              <p className="flex items-center justify-end gap-1 text-[11.5px] text-muted-foreground">
                {t("wallet.addMoney")}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </p>
            </div>
          </button>
        </section>

        {/* ------------------------------------------------ account */}
        <section aria-label={t("profile.groupAccount")}>
          <GroupLabel>{t("profile.groupAccount")}</GroupLabel>
          <ListGroup>
            <PersonalInfoDialog name={user.name ?? ""} />
            <LanguageDialog />
          </ListGroup>
        </section>

        {/* ------------------------------------------------ charts */}
        <section aria-label={t("profile.groupCharts")}>
          <GroupLabel>{t("profile.groupCharts")}</GroupLabel>
          <ListGroup>
            <ListRow
              icon={CircleUser}
              title={t("profile.birthProfiles")}
              sub={t("profile.birthProfilesBody")}
              right={
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-[12px] font-semibold text-accent-foreground">
                  {profiles.length}
                </span>
              }
              chevron
              onClick={() => push({ id: "profile.birthProfiles" })}
            />
            <ListRow
              icon={MessageSquare}
              title={t("consultation.history")}
              sub={t("profile.consultationsBody")}
              chevron
              onClick={() => push({ id: "consultation.history" })}
            />
            <ListRow
              icon={ScrollText}
              title={t("reports.title")}
              sub={t("reports.subtitle")}
              chevron
              onClick={() => push({ id: "reports.list" })}
            />
          </ListGroup>
        </section>

        {/* ------------------------------------------------ preferences */}
        <section aria-label={t("profile.groupPreferences")}>
          <GroupLabel>{t("profile.groupPreferences")}</GroupLabel>
          <ListGroup>
            <ListRow
              icon={Bell}
              title={t("profile.notifications")}
              sub={t("profile.notifNote").split(".")[0] + "."}
              chevron
              onClick={() => push({ id: "profile.notifications" })}
            />
            <ListRow
              icon={BellRing}
              title={t("profile.notificationHistory")}
              chevron
              onClick={() => push({ id: "notifications.center" })}
            />
          </ListGroup>
        </section>

        {/* ------------------------------------------------ privacy & support */}
        <section aria-label={t("profile.groupPrivacy")}>
          <GroupLabel>{t("profile.groupPrivacy")}</GroupLabel>
          <ListGroup>
            <ListRow
              icon={ShieldCheck}
              title={t("profile.privacy")}
              sub={t("profile.privacyTitle")}
              chevron
              onClick={() => push({ id: "profile.privacy" })}
            />
            <ListRow
              icon={Lock}
              title={t("profile.security")}
              chevron
              onClick={() => push({ id: "profile.security" })}
            />
            <ListRow icon={HelpCircle} title={t("profile.help")} chevron onClick={() => push({ id: "profile.help" })} />
            <ListRow
              icon={LifeBuoy}
              title={t("profile.support")}
              chevron
              onClick={() => push({ id: "profile.support" })}
            />
            <TermsDialog />
          </ListGroup>
        </section>

        {/* ------------------------------------------------ session */}
        <section aria-label={t("profile.logout")}>
          <ListGroup>
            <LogoutRow />
          </ListGroup>
        </section>

        <section aria-label={t("profile.deleteAccount")}>
          <ListGroup>
            <ListRow
              icon={Trash2}
              title={t("profile.deleteAccount")}
              destructive
              chevron
              onClick={() => push({ id: "profile.delete" })}
            />
          </ListGroup>
        </section>

        <p className="pb-2 text-center text-[11px] text-muted-foreground/70">
          {t("common.appName")} · {t("common.tagline")}
        </p>
        <p className="pb-2 text-center text-[11px] text-muted-foreground/60">
          {t("profile.dataCredits")}
        </p>
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>;
}

function initialsOf(name: string | null): string {
  if (!name) return "T";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || "T";
}

// ---------------------------------------------------------------- personal info

function PersonalInfoDialog({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const refreshMe = useRefreshMe();

  const save = useMutation({
    mutationFn: () => userService.update({ name: value.trim() }),
    onSuccess: async () => {
      await refreshMe();
      toast.success(t("profile.nameSaved"));
      setOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(name);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="press flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left hover:bg-secondary/60"
          aria-label={t("profile.personalInfo")}
        >
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
            <User className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{t("profile.personalInfo")}</span>
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{name}</span>
          </span>
          <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[360px] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-left">{t("profile.personalInfo")}</DialogTitle>
          <DialogDescription className="text-left">
            <Pencil className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {t("profile.editName")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-[13px] font-medium">
              {t("profile.name")}
            </label>
            <Input
              id="profile-name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={60}
              placeholder={t("profile.namePlaceholder")}
              className="h-12 rounded-2xl text-[15px]"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || value.trim().length < 1}
            className="rounded-full press"
          >
            {save.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- language

function LanguageDialog() {
  const locale = useLocaleStore((s) => s.locale);
  const changeLocale = useLocaleStore((s) => s.changeLocale);
  const [open, setOpen] = useState(false);

  const current = LOCALES.find((l) => l.code === locale);

  const pick = (code: (typeof LOCALES)[number]["code"]) => {
    changeLocale(code);
    // t() reads the new locale synchronously — the toast confirms in it.
    toast.success(t("profile.languageChanged"));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="press flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left hover:bg-secondary/60"
          aria-label={t("profile.language")}
        >
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
            <Languages className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{t("profile.language")}</span>
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{t("profile.languageNote")}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-[13.5px] font-medium text-foreground">{current?.nativeLabel}</span>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[360px] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left font-display">{t("profile.language")}</DialogTitle>
          <DialogDescription className="text-left">{t("profile.languageNote")}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t("profile.language")} className="space-y-2">
          {LOCALES.map((l) => {
            const active = locale === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(l.code)}
                className={
                  "press flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors " +
                  (active ? "border-primary/40 bg-accent/60" : "bg-card hover:bg-secondary/70")
                }
              >
                <span className="flex items-center gap-3.5">
                  <span
                    aria-hidden
                    className={
                      "flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold " +
                      (active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/75")
                    }
                  >
                    {l.code === "hi" ? "अ" : "A"}
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-semibold">{l.nativeLabel}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">{l.label}</span>
                  </span>
                </span>
                {active ? <Check className="h-4.5 w-4.5 shrink-0 text-success" strokeWidth={2.25} /> : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- terms

function TermsDialog() {
  const items = [
    { key: "termsDemo", icon: Check },
    { key: "termsGuidance", icon: ScrollText },
    { key: "termsData", icon: ShieldCheck },
    { key: "termsSupport", icon: LifeBuoy },
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="press flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left hover:bg-secondary/60"
          aria-label={t("profile.terms")}
        >
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
            <ScrollText className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{t("profile.terms")}</span>
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
              {t("profile.termsTitle")}
            </span>
          </span>
          <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[380px] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left font-display">{t("profile.termsTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto scroll-thin pr-1">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{t("profile.termsIntro")}</p>
          <ul className="mt-3 space-y-3">
            {items.map((item) => (
              <li key={item.key} className="flex items-start gap-2.5">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
                <span className="text-[13px] leading-relaxed">{t(`profile.${item.key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button className="w-full rounded-full press">{t("profile.termsClose")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- logout

function LogoutRow() {
  const logout = useSignOut();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="press flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left hover:bg-secondary/60"
          aria-label={t("profile.logout")}
        >
          <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
            <LogOut className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{t("profile.logout")}</span>
          </span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[360px] rounded-3xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{t("profile.logoutConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>{t("profile.logoutBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-full">{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="rounded-full press"
          >
            {logout.isPending ? t("common.loading") : t("profile.logout")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ProfileScreen;
