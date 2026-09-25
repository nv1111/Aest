import { type LucideIcon, Info, Lock, ReceiptIndianRupee, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TrustNote — the recurring trust-signalling surface. Variants keep the tone
 * calm: informative, never alarming.
 */
export function TrustNote({
  icon,
  children,
  variant = "info",
  className,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: "info" | "privacy" | "pricing";
  className?: string;
}) {
  const styles = {
    info: "bg-secondary/70 text-secondary-foreground border-transparent",
    privacy: "bg-success/8 text-foreground border-success/25",
    pricing: "bg-warning/10 text-foreground border-warning/30",
  } as const;
  const icons = { info: Info, privacy: ShieldCheck, pricing: ReceiptIndianRupee } as const;
  const Icon = icon ?? icons[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed",
        styles[variant],
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
