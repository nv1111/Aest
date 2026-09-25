import { FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/i18n";

/** Honest demo-data marker. Shown wherever mock-engine data appears. */
export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
        >
          <FlaskConical className="h-3 w-3" />
          {t("common.demoData")}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-center text-xs">
        {t("common.demoDataNote")}
      </TooltipContent>
    </Tooltip>
  );
}
