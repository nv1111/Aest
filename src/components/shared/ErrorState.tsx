"use client";

import { type LucideIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  icon,
  title,
  body,
  onRetry,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  onRetry?: () => void;
}) {
  const Icon = icon ?? RotateCcw;
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center" role="alert">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-[17px] font-semibold text-foreground">{title}</h3>
      {body ? (
        <p className="mt-1.5 max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-5 h-11 rounded-full px-6 press">
          <RotateCcw className="mr-2 h-4 w-4" /> Retry
        </Button>
      ) : null}
    </div>
  );
}
