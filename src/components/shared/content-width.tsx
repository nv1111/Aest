import { cn } from "@/lib/utils";

/**
 * Responsive content width tokens — the single source of truth for how every
 * screen's content centers itself across mobile / tablet / desktop.
 *
 * Mobile: full width (the phone layout stays exactly as designed).
 * md/lg+: a centered column whose width depends on the screen type.
 *
 * Screen passes `width` to ScreenScaffold / ScreenHeader, or wraps content in
 * <ContentColumn width="…"> for bare layouts (chat screens).
 */
export type ContentWidth = "narrow" | "default" | "wide" | "chat" | "full";

export const contentWidthClass: Record<ContentWidth, string> = {
  /** Forms, consent/pricing screens, payment results. */
  narrow: "md:max-w-xl",
  /** Details screens, articles, lists, settings. */
  default: "md:max-w-2xl xl:max-w-3xl",
  /** Card grids & dashboards (home, astrologers, reports, panchang…). */
  wide: "md:max-w-3xl lg:max-w-5xl xl:max-w-6xl",
  /** Conversations (Ask, consultation chat) — ChatGPT-like column. */
  chat: "md:max-w-xl lg:max-w-[760px]",
  /** Edge-to-edge screens that manage their own layout. */
  full: "",
};

export function ContentColumn({
  width = "default",
  className,
  children,
}: {
  width?: ContentWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full", contentWidthClass[width], className)}>{children}</div>;
}
