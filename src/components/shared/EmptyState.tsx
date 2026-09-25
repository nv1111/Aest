import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-[17px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-5 h-11 rounded-full px-6 press">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
