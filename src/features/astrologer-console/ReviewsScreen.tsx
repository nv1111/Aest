"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { enIN, hi } from "date-fns/locale";
import { Star } from "lucide-react";
import { getLocale, t } from "@/i18n";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { StarRow, useConsoleDashboard } from "./shared";
import type { ConsoleReviewDTO } from "@/types/console";

/**
 * Astrologer console → Reviews (tab root, id "ast.reviews").
 *
 * Summary card (average + count) + the latest reviews. Seeded demo reviews
 * are honestly labelled — real customer reviews land here too after Phase 2
 * consultations are rated.
 */

function relativeDate(iso: string): string {
  const locale = getLocale() === "hi" ? hi : enIN;
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale });
}

function ReviewRow({ r }: { r: ConsoleReviewDTO }) {
  return (
    <li className="px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <StarRow rating={r.rating} />
        <span className="truncate text-[12.5px] font-semibold text-foreground">{r.authorName}</span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relativeDate(r.createdAt)}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">{r.text}</p>
    </li>
  );
}

function ReviewsBody({
  reviews,
  rating,
  reviewCount,
}: {
  reviews: ConsoleReviewDTO[];
  rating: number;
  reviewCount: number;
}) {
  return (
    <div className="space-y-6 pt-1">
      {/* ------------------------------------------------------------ summary */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        aria-label={t("console.reviews.title")}
      >
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <div className="shrink-0 text-center">
            <p className="font-display text-[34px] font-semibold leading-none text-foreground">
              {rating.toFixed(1)}
            </p>
            <div className="mt-1.5 flex justify-center">
              <StarRow rating={rating} />
            </div>
          </div>
          <div className="min-w-0 flex-1 border-l border-hairline pl-4">
            <p className="text-[13px] font-medium text-foreground">{t("console.reviews.count", { count: reviewCount })}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t("console.reviews.latest")} · {t("console.reviews.average", { rating: rating.toFixed(1) })}
            </p>
            <div className="mt-2">
              <DemoDataBadge />
            </div>
          </div>
        </div>
      </motion.section>

      {/* --------------------------------------------------------------- list */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
        aria-label={t("console.reviews.latest")}
      >
        <SectionHeader>{t("console.reviews.latest")}</SectionHeader>
        {reviews.length === 0 ? (
          <EmptyState icon={Star} title={t("console.reviews.empty")} body={t("console.reviews.demoNote")} />
        ) : (
          <ul className="divide-y divide-hairline/70 overflow-hidden rounded-2xl border bg-card">
            {reviews.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </ul>
        )}
        <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {t("console.reviews.demoNote")}
        </p>
      </motion.section>
    </div>
  );
}

export default function ReviewsScreen() {
  const query = useConsoleDashboard();
  const d = query.data;

  return (
    <ConsoleScreen title={t("console.reviews.title")} width="default">
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError || !d ? (
        <ErrorState title={t("console.common.loadError")} onRetry={() => query.refetch()} />
      ) : (
        <ReviewsBody
          reviews={d.reviews}
          rating={d.astrologer.rating}
          reviewCount={d.astrologer.reviewCount}
        />
      )}
    </ConsoleScreen>
  );
}
