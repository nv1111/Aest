"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * CarouselRow — the app's horizontal card scroller.
 *
 * Mobile: pure swipe + right edge fade (unchanged classic behaviour).
 * md+: adds calm prev/next arrows that fade out at the track ends.
 *
 * Render children directly (each child owns its own shrink-0 width).
 */
export function CarouselRow({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  /** a11y label for the scroll region (e.g. the section title). */
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  // data loads asynchronously → re-measure on every render pass (cheap).
  useEffect(() => {
    update();
  });

  // viewport resizes re-measure too.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 336, behavior: "smooth" });
  };

  return (
    <div className={cn("relative -mx-4 md:-mx-6", className)}>
      <div
        ref={ref}
        onScroll={update}
        role="region"
        aria-label={label}
        className="scroll-thin flex gap-3 overflow-x-auto px-4 pb-1 md:px-6"
      >
        {children}
      </div>
      {/* mobile hint — more content to the right */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
        aria-hidden
      />
      {/* desktop affordance — prev/next arrows, fade at track ends */}
      <button
        type="button"
        aria-label={t("astrologers.carouselBack")}
        onClick={() => scrollBy(-1)}
        className={cn(
          "press absolute top-1/2 left-1 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm transition-opacity md:flex",
          !canPrev && "pointer-events-none opacity-0"
        )}
      >
        <ChevronLeft className="h-4.5 w-4.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={t("astrologers.carouselForward")}
        onClick={() => scrollBy(1)}
        className={cn(
          "press absolute top-1/2 right-1 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm transition-opacity md:flex",
          !canNext && "pointer-events-none opacity-0"
        )}
      >
        <ChevronRight className="h-4.5 w-4.5" strokeWidth={2} />
      </button>
    </div>
  );
}
