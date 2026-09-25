import { cn } from "@/lib/utils";

/** Label → value list row used across profile/settings/panchang screens. */
export function InfoRow({
  label,
  value,
  sub,
  right,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <div className="min-w-0">
        <div className="text-[13px] text-muted-foreground">{label}</div>
        {sub ? <div className="text-[12px] text-muted-foreground/70">{sub}</div> : null}
      </div>
      <div className="flex items-center gap-2 text-right">
        <div className="text-[13.5px] font-medium text-foreground">{value}</div>
        {right}
      </div>
    </div>
  );
}
