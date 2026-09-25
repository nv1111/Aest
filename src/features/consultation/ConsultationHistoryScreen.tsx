"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone, Video, MoonStar, Clock3, ChevronRight } from "lucide-react";
import { consultationsService } from "@/services/consultations";
import { useAppStore } from "@/store/app";
import { t } from "@/i18n";
import { formatDateIN, formatDuration, formatINR } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ConsultationDTO } from "@/types/models";

/** Consultation history — every record with its honest bill. */

const MODE_ICON = { chat: MessageCircle, audio: Phone, video: Video } as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusChip({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11.5px] font-semibold text-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
        {t("consultation.ongoing")}
      </span>
    );
  }
  if (status === "ended") {
    return (
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground">
        {t("consultation.completed")}
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground">
        {t("consultation.cancelled")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground">
      {t("consultation.statusRequested")}
    </span>
  );
}

export default function ConsultationHistoryScreen() {
  const push = useAppStore((s) => s.push);
  const [tab, setTab] = useState("completed");

  const query = useQuery({
    queryKey: ["consultations", "history"],
    queryFn: () => consultationsService.list({ limit: 50 }),
    staleTime: 30_000,
  });

  const all = query.data?.consultations ?? [];
  const ended = all.filter((c) => c.status === "ended" || c.status === "cancelled");
  const active = all.filter((c) => c.status === "active");
  const upcoming = all.filter((c) => c.status === "requested");

  const open = (c: ConsultationDTO) => {
    if (c.status === "active") {
      push({ id: "consultation.chat", params: { id: c.id } });
    } else {
      push({ id: "consultation.details", params: { id: c.id } });
    }
  };

  return (
    <ScreenScaffold title={t("consultation.history")}>
      <Tabs value={tab} onValueChange={setTab} className="pt-1">
        <TabsList className="h-11 w-full rounded-full p-1">
          <TabsTrigger value="completed" className="h-9 flex-1 rounded-full text-[12.5px]">
            {t("consultation.completed")}
          </TabsTrigger>
          <TabsTrigger value="active" className="h-9 flex-1 rounded-full text-[12.5px]">
            {t("consultation.active")}
            {active.length > 0 ? (
              <span className="ml-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {active.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="h-9 flex-1 rounded-full text-[12.5px]">
            {t("consultation.upcoming")}
          </TabsTrigger>
        </TabsList>

        {query.isLoading ? (
          <div className="pt-4">
            <PageSkeleton variant="list" />
          </div>
        ) : query.isError ? (
          <ErrorState title={t("common.errorGeneric")} onRetry={() => query.refetch()} />
        ) : (
          <>
            <TabsContent value="completed" className="mt-4">
              {ended.length === 0 ? (
                <EmptyState
                  icon={MoonStar}
                  title={t("consultation.noHistory")}
                  body={t("consultation.noHistoryBody")}
                  actionLabel={t("consultation.noHistoryCta")}
                  onAction={() => useAppStore.getState().setTab("astrologers")}
                />
              ) : (
                <div className="space-y-2.5">
                  {ended.map((c) => (
                    <HistoryCard key={c.id} c={c} onClick={() => open(c)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active" className="mt-4">
              {active.length === 0 ? (
                <EmptyState icon={Clock3} title={t("consultation.noTabTitle")} body={t("consultation.noTabBody")} />
              ) : (
                <div className="space-y-2.5">
                  {active.map((c) => (
                    <HistoryCard key={c.id} c={c} onClick={() => open(c)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4">
              {upcoming.length === 0 ? (
                <EmptyState icon={Clock3} title={t("consultation.noTabTitle")} body={t("consultation.noTabBody")} />
              ) : (
                <div className="space-y-2.5">
                  {upcoming.map((c) => (
                    <HistoryCard key={c.id} c={c} onClick={() => open(c)} />
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </ScreenScaffold>
  );
}

function HistoryCard({ c, onClick }: { c: ConsultationDTO; onClick: () => void }) {
  const ModeIcon = MODE_ICON[(c.mode as keyof typeof MODE_ICON) ?? "chat"] ?? MessageCircle;
  const modeLabel =
    c.mode === "audio" ? t("consultation.modeAudio") : c.mode === "video" ? t("consultation.modeVideo") : t("consultation.modeChat");

  return (
    <button
      type="button"
      onClick={onClick}
      className="press block w-full rounded-2xl border bg-card p-4 text-left transition-shadow hover:shadow-md"
      aria-label={`${c.astrologer.displayName}, ${modeLabel}, ${
        c.durationSeconds ? formatDuration(c.durationSeconds) : t("consultation.ongoing")
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11 rounded-2xl border">
          <AvatarImage src={c.astrologer.photoUrl ?? undefined} alt={c.astrologer.displayName} />
          <AvatarFallback className="rounded-2xl bg-secondary text-[13px] font-semibold text-secondary-foreground">
            {initials(c.astrologer.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14px] font-semibold text-foreground">{c.astrologer.displayName}</p>
            <ModeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {formatDateIN(c.startedAt ?? c.createdAt, "datetime")}
            {c.durationSeconds ? ` · ${formatDuration(c.durationSeconds)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusChip status={c.status} />
          <span className="text-[13px] font-semibold text-foreground">
            {c.totalAmount != null ? formatINR(c.totalAmount) : t("consultation.ongoing")}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </button>
  );
}
