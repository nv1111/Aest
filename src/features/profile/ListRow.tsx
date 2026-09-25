"use client";

import { type LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ListRow — the one visual pattern for all settings/list rows across the app:
 * icon in a rounded tile, title, sub, right value, chevron when navigable.
 * 48px+ height, press feedback, destructive variant.
 */
export function ListRow({
  icon: Icon,
  title,
  sub,
  right,
  onClick,
  destructive,
  chevron,
  className,
  disabled,
  ariaLabel,
}: {
  icon?: LucideIcon;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const tile = destructive ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground/75";
  const content = (
    <>
      {Icon ? (
        <span className={cn("flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl", tile)}>
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[14px] font-medium",
            destructive && "text-destructive",
            disabled && "opacity-50"
          )}
        >
          {title}
        </span>
        {sub ? <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{sub}</span> : null}
      </span>
      {right ? <span className="flex shrink-0 items-center gap-1.5">{right}</span> : null}
      {chevron && onClick ? <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground" /> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? title}
        className={cn("press flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left hover:bg-secondary/60", className)}
      >
        {content}
      </button>
    );
  }
  return <div className={cn("flex min-h-13 items-center gap-3.5 px-4 py-2.5", className)}>{content}</div>;
}

/** The card wrapper that groups ListRows with hairline dividers. */
export function ListGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card divide-y divide-hairline/70", className)}>
      {children}
    </div>
  );
}
