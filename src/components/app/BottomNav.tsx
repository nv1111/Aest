"use client";

import { Home, MessageCircle, Orbit, Users, CircleUser } from "lucide-react";
import { useAppStore, type TabId } from "@/store/app";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const TABS: { id: TabId; icon: typeof Home; label: string }[] = [
  { id: "home", icon: Home, label: t("nav.home") },
  { id: "ask", icon: MessageCircle, label: t("nav.ask") },
  { id: "astrology", icon: Orbit, label: t("nav.astrology") },
  { id: "astrologers", icon: Users, label: t("nav.astrologers") },
  { id: "profile", icon: CircleUser, label: t("nav.profile") },
];

/** Primary bottom navigation — five destinations, large touch targets. */
export function BottomNav() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/92 backdrop-blur-md safe-bottom"
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
              className={cn(
                "press flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                  active && "bg-accent"
                )}
              >
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2 : 1.75} />
              </span>
              <span className={cn("text-[10.5px] font-medium tracking-wide", active && "font-semibold")}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
