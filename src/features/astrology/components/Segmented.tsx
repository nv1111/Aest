"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented control — the calm pill switch used for D1/D9, panchang dates,
 * time accuracy. Touch-safe (44px), keyboard-accessible, aria-labelled.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex w-full gap-1 rounded-2xl bg-secondary p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "press flex-1 rounded-xl font-medium leading-none transition-colors",
              size === "md" ? "min-h-[44px] px-3 py-2.5 text-[13.5px]" : "min-h-[40px] px-2.5 py-2 text-[12.5px]",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
