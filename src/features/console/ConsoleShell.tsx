"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Star,
  BadgeCheck,
  MessagesSquare,
  LifeBuoy,
  LogOut,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useMe, useRefreshMe } from "@/hooks/useSession";
import { demoService } from "@/services/console";
import { useConsoleStore, useCurrentConsoleScreen, type ConsolePersona } from "@/store/console";
import { useLocaleStore } from "@/store/locale";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/http";
import { withSuspense, ConsoleScreenFor } from "./registry";
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

/**
 * ConsoleShell — Phase 2 role-switch demo surface.
 *
 * Rendered by AppShell when me.user.demoPersona is "astrologer" or "admin".
 * Own layout, own navigation, own screen stacks (store/console.ts) — the
 * customer app's nav state is never touched, so switching back and forth is
 * always clean. Mobile: bottom tabs like the customer app. md+: a labelled
 * side rail. The DEMO badge and exit control are always visible.
 */

type TabDef = { id: string; icon: typeof LayoutDashboard; label: string };

const astrologerTabs = (): TabDef[] => [
  { id: "dashboard", icon: LayoutDashboard, label: t("console.nav.dashboard") },
  { id: "chats", icon: MessageSquare, label: t("console.nav.chats") },
  { id: "reviews", icon: Star, label: t("console.nav.reviews") },
];

const adminTabs = (): TabDef[] => [
  { id: "dashboard", icon: LayoutDashboard, label: t("console.admin.nav.dashboard") },
  { id: "astrologers", icon: BadgeCheck, label: t("console.admin.nav.astrologers") },
  { id: "consultations", icon: MessagesSquare, label: t("console.admin.nav.consultations") },
  { id: "support", icon: LifeBuoy, label: t("console.admin.nav.support") },
];

export function ConsoleShell({ persona }: { persona: ConsolePersona }) {
  const me = useMe();
  const locale = useLocaleStore((s) => s.locale);
  const screen = useCurrentConsoleScreen();
  const setPersona = useConsoleStore((s) => s.setPersona);
  const tab = useConsoleStore((s) => s.tab);
  const setTab = useConsoleStore((s) => s.setTab);
  const resetCustomerTab = useAppStore((s) => s.resetTab);
  const refreshMe = useRefreshMe();
  const [confirmExit, setConfirmExit] = useState(false);

  // keep the console store persona in sync with the session (persona switched
  // on another tab / fresh reload). Idempotent for the same persona.
  useEffect(() => {
    setPersona(persona);
  }, [persona, setPersona]);

  const exit = useMutation({
    mutationFn: () => demoService.setPersona("user"),
    onSuccess: () => {
      resetCustomerTab("home");
      void refreshMe();
      toast.success(t("console.demo.backToCustomer"));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const TABS = persona === "astrologer" ? astrologerTabs() : adminTabs();
  const account = me.data?.astrologerAccount ?? null;
  const isAstro = persona === "astrologer";
  const title = isAstro ? t("console.shell.astrologerConsole") : t("console.shell.adminConsole");
  const personaName = isAstro ? (account?.displayName ?? title) : "Super Admin";

  const itemClass = (active: boolean) =>
    cn(
      "press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors lg:w-full lg:justify-start lg:gap-3.5 lg:px-3.5",
      active
        ? "bg-accent text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ------------------------------------------------------- console header */}
      <header className="z-30 shrink-0 border-b border-hairline bg-background/92 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground"
          >
            {isAstro && account?.photoUrl ? (
               
              <img src={account.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-display text-[16px] font-semibold leading-tight">{personaName}</p>
              <span className="shrink-0 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[9.5px] font-bold tracking-wider text-primary">
                {t("console.common.demoBadge")}
              </span>
            </div>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {title} · {t("console.shell.youAreDemoing")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            aria-label={t("console.common.exitDemo")}
            className="press flex h-11 items-center gap-2 rounded-2xl border border-hairline bg-card px-3.5 text-[12.5px] font-medium text-foreground hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">{t("console.common.exitDemo")}</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ content */}
      <div className="relative flex min-h-0 flex-1">
        {/* side rail (md+) */}
        <aside
          aria-label={title}
          className="sticky top-0 z-20 hidden h-full shrink-0 flex-col border-r border-hairline bg-background md:flex md:w-[78px] lg:w-56 lg:px-3"
        >
          <nav className="scroll-thin flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3 lg:items-stretch">
            {TABS.map(({ id, icon: Icon, label }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={itemClass(active)}
                >
                  <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={active ? 2 : 1.75} />
                  <span className={cn("hidden text-[14px] lg:block", active ? "font-semibold" : "font-medium")}>
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* screen */}
        <div className="relative min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${screen.id}?${JSON.stringify(screen.params ?? {})}-${locale}`}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {withSuspense(ConsoleScreenFor(persona, screen.id, screen.params))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* --------------------------------------------------- bottom tabs (mobile) */}
      <nav
        aria-label={title}
        className="z-40 shrink-0 border-t border-hairline bg-background/92 backdrop-blur-md safe-bottom md:hidden"
      >
        <div className="mx-auto flex max-w-[430px] items-stretch justify-around px-1 pb-1 pt-1">
          {TABS.map(({ id, icon: Icon, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="press flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2"
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-accent text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2 : 1.75} />
                </span>
                <span
                  className={cn(
                    "max-w-[72px] truncate text-[10.5px] font-medium tracking-wide",
                    active ? "font-semibold text-primary" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* exit confirm */}
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("console.demo.confirmLeaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("console.demo.confirmLeaveDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("console.demo.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => exit.mutate()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("console.demo.confirmLeaveAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
