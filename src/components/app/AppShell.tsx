"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useMe, useAppOpenedTracking } from "@/hooks/useSession";
import { useCurrentScreen } from "@/store/app";
import { ScreenFor, withSuspense } from "./screens";
import { BottomNav } from "./BottomNav";
import { Splash } from "./Splash";

/**
 * AppShell — the mobile app frame. One route, client-side navigation.
 * Desktop: centered 430px frame on a calm backdrop, so the product reads as
 * a deliberate mobile app rather than a stretched website.
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
      return <div className="h-full">{ScreenFor("onboarding", undefined)}</div>;
    }
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${screen.id}?${JSON.stringify(screen.params ?? {})}`}
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
    <div className="flex min-h-dvh justify-center bg-[oklch(0.93_0.01_84)]">
      {/* quiet desktop framing */}
      <aside className="fixed left-10 top-1/2 hidden -translate-y-1/2 select-none flex-col gap-2 xl:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="font-display text-xl font-semibold">Tara</span>
        </div>
        <p className="max-w-[210px] text-[12.5px] leading-relaxed text-foreground/60">
          Jyotish, explained simply. Private by default, clear pricing, honest answers.
        </p>
      </aside>

      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden border-x border-hairline/70 bg-background shadow-2xl shadow-black/10">
        <div className="relative flex-1 min-h-0">{body}</div>
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}
