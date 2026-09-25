"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/** Calm brand splash — no cosmic effects, just a quiet fade. */
export function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 tara-hero">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
      >
        <Sparkles className="h-7 w-7" strokeWidth={1.75} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="text-center"
      >
        <p className="font-display text-2xl font-semibold tracking-tight">Tara</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Your personal jyotish guide</p>
      </motion.div>
    </div>
  );
}
