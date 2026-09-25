"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Star, Clock3 } from "lucide-react";
import type { AstrologerDTO } from "@/types/models";
import { formatINR } from "@/lib/money";
import { t } from "@/i18n";

/** Availability dot + label. */
export function AvailabilityBadge({ a }: { a: Pick<AstrologerDTO, "onlineStatus" | "availableFrom"> }) {
  if (a.onlineStatus === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
        {t("common.online")}
      </span>
    );
  }
  if (a.onlineStatus === "away" && a.availableFrom) {
    const hrs = Math.max(1, Math.round((new Date(a.availableFrom).getTime() - Date.now()) / 3600000));
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        {t("common.availableSoon")} · ~{hrs}h
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
      {t("common.offline")}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * AstrologerCard — the marketplace's trust surface. Verification badge comes
 * from API data only; price is always visible; rating shows sample size.
 */
export function AstrologerCard({
  a,
  onClick,
  compact,
}: {
  a: AstrologerDTO;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press block w-full rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-shadow hover:shadow-md"
      aria-label={`${a.displayName}, ${formatINR(a.pricePerMinute)} per minute`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14 rounded-2xl border">
            <AvatarImage src={a.photoUrl ?? undefined} alt={a.displayName} />
            <AvatarFallback className="rounded-2xl bg-secondary font-display text-[16px] font-semibold text-secondary-foreground">
              {initials(a.displayName)}
            </AvatarFallback>
          </Avatar>
          {a.onlineStatus === "online" ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-success"
              aria-label="Online now"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[14.5px] font-semibold leading-tight text-foreground">
              {a.displayName}
            </h3>
            {a.isVerified ? (
              <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label={t("common.verified")} />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {a.expertise.slice(0, 2).join(" · ")}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
              {a.rating.toFixed(1)}
            </span>
            <span aria-hidden>·</span>
            <span>{a.reviewCount} {t("astrologers.reviews")}</span>
            <span aria-hidden>·</span>
            <span>
              {a.languages.slice(0, 2).join(", ")}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
          <span className="whitespace-nowrap rounded-full bg-primary/8 px-2.5 py-1 text-[12.5px] font-semibold text-primary">
            {formatINR(a.pricePerMinute)}
            <span className="font-medium text-primary/80">{t("common.perMinute")}</span>
          </span>
          {!compact ? (
            <div className="mt-1.5">
              <AvailabilityBadge a={a} />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
