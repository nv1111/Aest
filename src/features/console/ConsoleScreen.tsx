"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConsoleStore } from "@/store/console";
import { cn } from "@/lib/utils";
import { contentWidthClass, type ContentWidth } from "@/components/shared/content-width";

/**
 * Console screen scaffold — the console twin of the customer app's
 * ScreenScaffold/ScreenHeader. Back pops the CONSOLE stack (store/console),
 * never the customer app's stack. Tabs-level screens have no back button.
 */
export function ConsoleScreen({
  title,
  subtitle,
  right,
  onBack,
  children,
  contentClassName,
  width = "default",
  bare,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  width?: ContentWidth;
  bare?: boolean;
}) {
  const canPop = useConsoleStore((s) => s.stacks[s.tab].length > 1);
  const pop = useConsoleStore((s) => s.pop);
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (canPop) return pop();
    router.push("/");
  };

  if (bare) {
    return <div className={cn("flex h-full min-h-0 flex-col", contentClassName)}>{children}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-30 shrink-0 bg-background/92 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex w-full items-center gap-2 px-4 pt-3 pb-2.5 md:px-6",
            contentWidthClass[width]
          )}
        >
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground press hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[19px] font-semibold leading-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-[12.5px] leading-snug text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {right ? <div className="flex items-center gap-1.5">{right}</div> : null}
        </div>
      </header>
      <div
        className={cn(
          "scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-28 md:px-6 md:pb-12",
          contentClassName
        )}
      >
        <div className={cn("mx-auto w-full md:max-w-2xl xl:max-w-3xl", contentWidthClass[width])}>
          {children}
        </div>
      </div>
    </div>
  );
}
