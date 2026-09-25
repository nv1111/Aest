"use client";

import {
  Home,
  MessageCircle,
  Orbit,
  Users,
  CircleUser,
  Wallet,
  FileText,
  History,
  Bell,
  Sparkles,
} from "lucide-react";
import { useAppStore, useCurrentScreen, type TabId } from "@/store/app";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const PRIMARY: { id: TabId; icon: typeof Home; label: string }[] = [
  { id: "home", icon: Home, label: t("nav.home") },
  { id: "ask", icon: MessageCircle, label: t("nav.ask") },
  { id: "astrology", icon: Orbit, label: t("nav.astrology") },
  { id: "astrologers", icon: Users, label: t("nav.astrologers") },
  { id: "profile", icon: CircleUser, label: t("nav.profile") },
];

/** Destinations that live inside a tab's stack (quick links on desktop). */
const QUICK: {
  tab: TabId;
  screen: { id: string };
  icon: typeof Home;
  label: string;
  active: (screenId: string) => boolean;
}[] = [
  {
    tab: "profile",
    screen: { id: "wallet.home" },
    icon: Wallet,
    label: t("nav.wallet"),
    active: (id) => id.startsWith("wallet.") || id === "payment.result",
  },
  {
    tab: "home",
    screen: { id: "reports.list" },
    icon: FileText,
    label: t("nav.reports"),
    active: (id) => id.startsWith("reports."),
  },
  {
    tab: "home",
    screen: { id: "consultation.history" },
    icon: History,
    label: t("nav.consultations"),
    active: (id) => id.startsWith("consultation."),
  },
  {
    tab: "home",
    screen: { id: "notifications.center" },
    icon: Bell,
    label: t("nav.notifications"),
    active: (id) => id.startsWith("notifications."),
  },
];

/**
 * Sidebar navigation for large screens.
 * Tablet (md): slim icon rail. Desktop (lg+): full labeled sidebar.
 * Mobile never renders this — it keeps the bottom navigation.
 */
export function AppSidebar() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const openInTab = useAppStore((s) => s.openInTab);
  const current = useCurrentScreen();

  const quickActive = QUICK.some((q) => q.active(current.id));

  const itemClass = (active: boolean) =>
    cn(
      "press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors lg:w-full lg:justify-start lg:gap-3.5 lg:px-3.5",
      active
        ? "bg-accent text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    );

  return (
    <aside
      aria-label="Primary"
      className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-hairline bg-background md:flex md:w-[78px] lg:w-64 lg:px-3.5"
    >
      <div className="flex h-16 shrink-0 items-center justify-center lg:justify-start lg:px-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="hidden font-display text-xl font-semibold tracking-tight lg:block">Tara</span>
        </div>
      </div>

      <nav className="scroll-thin flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2 lg:items-stretch">
        {PRIMARY.map(({ id, icon: Icon, label }) => {
          const active = tab === id && !quickActive;
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

        <div className="my-2 h-px w-10 shrink-0 bg-hairline lg:w-full" role="separator" />

        {QUICK.map(({ tab: hostTab, screen, icon: Icon, label, active }) => {
          const isActive = active(current.id);
          return (
            <button
              key={label}
              type="button"
              onClick={() => openInTab(hostTab, screen)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={itemClass(isActive)}
            >
              <Icon className="h-[21px] w-[21px] shrink-0" strokeWidth={isActive ? 2 : 1.75} />
              <span className={cn("hidden text-[14px] lg:block", isActive ? "font-semibold" : "font-medium")}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="hidden shrink-0 px-3.5 pb-4 lg:block">
        <p className="border-t border-hairline pt-3 text-[11px] leading-relaxed text-muted-foreground/70">
          {t("nav.tagline")}
        </p>
      </div>
    </aside>
  );
}
