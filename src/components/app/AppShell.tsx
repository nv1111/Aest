"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMe, useAppOpenedTracking } from "@/hooks/useSession";
import { useCurrentScreen } from "@/store/app";
import { useLocaleStore } from "@/store/locale";
import { ScreenFor, withSuspense } from "./screens";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { Splash } from "./Splash";

/**
 * AppShell — one route, client-side navigation.
 *
 * Mobile: the 430px phone frame + bottom navigation (unchanged, as designed).
 * md+ (tablet / laptop / desktop): a real web application layout — sidebar
 * navigation (icon rail on tablet, labeled on desktop) + full-width content.
 *
 * The `booted` latch prevents a render oscillation: a logged-out `me` query
 * errors, the onboarding mounts a new observer, refetchOnMount flips status
 * back to pending, and isLoading would swap Splash in again — forever.
 * Once the first fetch settles, we never return to the Splash.
 */
export function AppShell() {
  useAppOpenedTracking();
  const me = useMe();
  const screen = useCurrentScreen();
  const locale = useLocaleStore((s) => s.locale);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (me.isSuccess || me.isError || me.data) {
      setBooted(true);
    }
  }, [me.isSuccess, me.isError, me.data]);

  const body = (() => {
    if (!booted) {
      return <Splash />;
    }
    // Signed in AND onboarding complete (first chart created) → main app.
    // Otherwise stay in the onboarding flow so birth details are never skipped.
    const user = me.data?.user;
    if (!user || !user.onboardingDone) {
      // Onboarding was designed narrow — on large screens it stays a calm,
      // centered phone-sized card on the quiet backdrop.
      return (
        <div className="h-full md:grid md:place-items-center md:bg-[oklch(0.93_0.01_84)]">
          <div className="h-full w-full max-w-[430px] overflow-hidden bg-background md:h-[94dvh] md:max-h-[880px] md:rounded-[28px] md:border md:border-hairline/70 md:shadow-2xl md:shadow-black/10">
            {ScreenFor("onboarding", undefined)}
          </div>
        </div>
      );
    }
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${screen.id}?${JSON.stringify(screen.params ?? {})}-${locale}`}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute inset-0 flex flex-col overflow-hidden"
        >
          {withSuspense(ScreenFor(screen.id, screen.params))}
        </motion.div>
      </AnimatePresence>
    );
  })();

  const showNav = booted && !!me.data?.user?.onboardingDone;

  return (
    <div className="flex min-h-dvh justify-center bg-[oklch(0.93_0.01_84)] md:justify-start md:bg-background">
      {showNav ? <AppSidebar /> : null}
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden border-x border-hairline/70 bg-background shadow-2xl shadow-black/10 md:max-w-none md:min-w-0 md:flex-1 md:border-x-0 md:shadow-none">
        <div className="relative flex-1 min-h-0">{body}</div>
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
