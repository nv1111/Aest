"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "@/store/app";
import { cn } from "@/lib/utils";
import { contentWidthClass, type ContentWidth } from "./content-width";

/**
 * Standard screen header. Pops the client-side stack (not browser history),
 * so deep screens always behave consistently.
 *
 * The inner row is a centered column matching the screen's content width,
 * so the title aligns perfectly with the content below on every device.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  className,
  width = "default",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  className?: string;
  width?: ContentWidth;
}) {
  const pop = useAppStore((s) => s.pop);
  const canPop = useAppStore((s) => s.stacks[s.tab].length > 1);
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (canPop) {
      pop();
    } else {
      router.push("/");
    }
  };

  return (
    <header className={cn("sticky top-0 z-30 bg-background/92 backdrop-blur-md", className)}>
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
          <h1 className="truncate font-display text-[19px] font-semibold leading-tight text-foreground">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[12.5px] leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="flex items-center gap-1.5">{right}</div> : null}
      </div>
    </header>
  );
}
