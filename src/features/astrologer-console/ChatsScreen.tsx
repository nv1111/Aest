"use client";

import { motion } from "framer-motion";
import { LifeBuoy, MessageSquare } from "lucide-react";
import { useConsoleStore } from "@/store/console";
import { t } from "@/i18n";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import type { ConsoleConsultationDTO } from "@/types/console";
import {
  QueueCard,
  ActiveChatCard,
  EndedRow,
  QuietEmpty,
  useConsoleDashboard,
  useTicker,
} from "./shared";

/**
 * Astrologer console → Chats (tab root, id "ast.chats").
 *
 * Conversations view over the same dashboard query: the request queue (shown
 * only when requests are actually waiting), active chats with LIVE badges and
 * running durations, and the ended history (tap → read-only transcript).
 */

function ChatsBody({
  queue,
  active,
  ended,
  queueCount,
}: {
  queue: ConsoleConsultationDTO[];
  active: ConsoleConsultationDTO[];
  ended: ConsoleConsultationDTO[];
  queueCount: number;
}) {
  const push = useConsoleStore((s) => s.push);
  const now = useTicker(active.length > 0);
  const showQueue = queueCount > 0;

  const onAccepted = (c: ConsoleConsultationDTO) => {
    push({ id: "ast.chat", params: { consultationId: c.id } });
  };

  const isEmpty = !showQueue && active.length === 0 && ended.length === 0;

  if (isEmpty) {
    return (
      <div className="pt-4">
        <EmptyState icon={MessageSquare} title={t("console.chat.noChats")} body={t("console.chat.noChatsBody")} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-1">
      {/* ---------------------------------------------------- incoming requests */}
      {showQueue ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          aria-label={t("console.dash.queueTitle")}
        >
          <SectionHeader>
            {t("console.dash.queueTitle")}
            {queue.length > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {queue.length}
              </span>
            ) : null}
          </SectionHeader>
          <ul className="space-y-2.5">
            {queue.map((c) => (
              <QueueCard key={c.id} c={c} onAccepted={onAccepted} />
            ))}
          </ul>
        </motion.section>
      ) : null}

      {/* --------------------------------------------------------- active chats */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
        aria-label={t("console.dash.activeTitle")}
      >
        <SectionHeader>{t("console.dash.activeTitle")}</SectionHeader>
        {active.length === 0 ? (
          <QuietEmpty>{t("console.dash.activeEmpty")}</QuietEmpty>
        ) : (
          <ul className="space-y-2.5">
            {active.map((c) => (
              <ActiveChatCard key={c.id} c={c} now={now} />
            ))}
          </ul>
        )}
      </motion.section>

      {/* -------------------------------------------------------- ended history */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" }}
        aria-label={t("console.dash.recentTitle")}
      >
        <SectionHeader>{t("console.dash.recentTitle")}</SectionHeader>
        {ended.length === 0 ? (
          <QuietEmpty>{t("console.dash.recentEmpty")}</QuietEmpty>
        ) : (
          <ul className="divide-y divide-hairline/70 overflow-hidden rounded-2xl border bg-card">
            {ended.slice(0, 20).map((c) => (
              <EndedRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  );
}

export default function ChatsScreen() {
  const query = useConsoleDashboard();
  const d = query.data;

  return (
    <ConsoleScreen title={t("console.nav.chats")} width="wide">
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError || !d ? (
        <ErrorState icon={LifeBuoy} title={t("console.common.loadError")} onRetry={() => query.refetch()} />
      ) : (
        <ChatsBody
          queue={d.queue}
          active={d.active}
          ended={d.recentEnded}
          queueCount={d.stats.queueCount}
        />
      )}
    </ConsoleScreen>
  );
}
