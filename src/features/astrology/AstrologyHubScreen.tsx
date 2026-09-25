"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  HeartHandshake,
  Hourglass,
  MoonStar,
  Orbit,
  ScrollText,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "@/hooks/useSession";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

/** Astrology hub — tab root (no back button). Six calm module cards. */
const MODULES: { id: string; icon: LucideIcon; nameKey: string; subKey: string }[] = [
  { id: "astrology.kundli", icon: ScrollText, nameKey: "kundli", subKey: "kundliSubtitle" },
  { id: "astrology.dasha", icon: Hourglass, nameKey: "dasha", subKey: "dashaSubtitle" },
  { id: "astrology.transit", icon: Orbit, nameKey: "transit", subKey: "transitSubtitle" },
  { id: "astrology.panchang", icon: CalendarDays, nameKey: "panchang", subKey: "panchangSubtitle" },
  { id: "astrology.horoscope", icon: Sun, nameKey: "horoscope", subKey: "horoscopeSubtitle" },
  { id: "astrology.compatibility", icon: HeartHandshake, nameKey: "compatibility", subKey: "compatibilitySubtitle" },
];

export default function AstrologyHubScreen() {
  const me = useMe();
  const push = useAppStore((s) => s.push);
  const hasProfile = !!me.data?.primaryProfile;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      {/* tab-root header — mirrors Home's TopBar (no back button) */}
      <header className="sticky top-0 z-30 bg-background/92 px-4 pb-3 pt-5 backdrop-blur-md">
        <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground">
          {t("astrology.title")}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t("astrology.hubSubtitle")}</p>
      </header>

      <div className="px-4 pb-28">
        {me.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[108px] w-full rounded-3xl" />
            ))}
          </div>
        ) : !hasProfile ? (
          <EmptyState
            icon={MoonStar}
            title={t("astrology.hubNoProfileTitle")}
            body={t("astrology.hubNoProfileBody")}
            actionLabel={t("astrology.hubNoProfileCta")}
            onAction={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
          />
        ) : (
          <nav aria-label={t("astrology.title")} className="grid grid-cols-2 gap-3">
            {MODULES.map((m, i) => (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03, ease: "easeOut" }}
                onClick={() => push({ id: m.id })}
                className="press flex min-h-[44px] flex-col items-start gap-3 rounded-3xl border bg-card p-4 text-left hover:bg-secondary/50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/60 text-accent-foreground">
                  <m.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[16px] font-semibold leading-tight text-foreground">
                    {t(`astrology.${m.nameKey}`)}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                    {t(`astrology.${m.subKey}`)}
                  </span>
                </span>
              </motion.button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
