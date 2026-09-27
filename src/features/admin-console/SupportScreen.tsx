"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCheck, LifeBuoy, MessageSquareText, Quote, Send } from "lucide-react";
import { toast } from "sonner";
import { adminConsoleService } from "@/services/console";
import type { AdminSupportTicketDTO } from "@/types/console";
import { t } from "@/i18n";
import { formatDateIN } from "@/lib/money";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Admin console → Support (id "admin.support") — the customer ticket inbox.
 *
 * Filters are server-side: "Open" merges the `open` + `in_progress` status
 * params (the API has no "unresolved" value — two parallel fetches), "All"
 * sends no param, "Resolved" asks for resolved only.
 *
 * Resolve behaviour (documented choice): the Resolve button sends the agent's
 * textarea draft when one is written, otherwise a standard closing note —
 * the backend requires a 1..2000-char response on every reply.
 */

type Filter = "open" | "all" | "resolved";

const FILTERS: { id: Filter; labelKey: string }[] = [
  { id: "open", labelKey: "console.admin.support.filterOpen" },
  { id: "all", labelKey: "console.admin.support.filterAll" },
  { id: "resolved", labelKey: "console.admin.support.filterResolved" },
];

const CATEGORY_KEY: Record<string, string> = {
  general: "console.admin.support.categoryGeneral",
  billing: "console.admin.support.categoryBilling",
  privacy: "console.admin.support.categoryPrivacy",
  astrologer: "console.admin.support.categoryAstrologer",
  bug: "console.admin.support.categoryBug",
};

function StatusChip({ status }: { status: string }) {
  if (status === "resolved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success">
        <CheckCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        {t("console.admin.support.statusResolved")}
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        {t("console.admin.support.statusInProgress")}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
      {t("console.admin.support.statusOpen")}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: AdminSupportTicketDTO }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const userName = ticket.user.name ?? ticket.user.phone ?? "—";
  const resolved = ticket.status === "resolved";
  const longMessage = ticket.message.length > 180;

  const reply = useMutation({
    mutationFn: ({ response, resolved }: { response: string; resolved?: boolean }) =>
      adminConsoleService.replyTicket(ticket.id, response, resolved),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ["admin", "support"] });
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      setDraft("");
      if (vars.resolved) {
        toast.success(t("console.admin.support.resolveToast"));
      } else {
        toast.success(t("console.admin.support.replyToast", { name: userName }));
      }
    },
    onError: () => toast.error(t("console.admin.support.actionFailed")),
  });

  const sendReply = () => {
    const text = draft.trim();
    if (!text) return;
    reply.mutate({ response: text });
  };

  const resolve = () => {
    // written draft wins; otherwise the standard closing note
    const text = draft.trim() || t("console.admin.support.closingNote");
    reply.mutate({ response: text, resolved: true });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-[14.5px] font-semibold leading-tight text-foreground">{ticket.subject}</h3>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {userName}
            {ticket.user.phone ? ` · ${ticket.user.phone}` : ""} · {formatDateIN(ticket.createdAt, "datetime")}
          </p>
        </div>
        <StatusChip status={ticket.status} />
      </div>

      <span className="mt-2 inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-secondary-foreground">
        {t(CATEGORY_KEY[ticket.category] ?? CATEGORY_KEY.general)}
      </span>

      {/* customer message */}
      <div className="mt-2.5">
        <p
          className={cn(
            "text-[13px] leading-relaxed text-foreground/90",
            !expanded && longMessage && "line-clamp-3"
          )}
        >
          {ticket.message}
        </p>
        {longMessage ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="press mt-1 text-[12px] font-semibold text-primary"
          >
            {expanded ? t("console.admin.support.collapse") : t("console.admin.support.expand")}
          </button>
        ) : null}
      </div>

      {/* existing response, quoted */}
      {ticket.response ? (
        <blockquote className="mt-3 rounded-xl border-l-2 border-primary/40 bg-accent/60 px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-primary">
            <Quote className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            {t("console.admin.support.responseLabel")}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/90">{ticket.response}</p>
        </blockquote>
      ) : null}

      {/* reply composer — only while the ticket is unresolved */}
      {!resolved ? (
        <div className="mt-3.5 border-t border-hairline pt-3.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("console.admin.support.replyPlaceholder")}
            maxLength={2000}
            aria-label={t("console.admin.support.replyPlaceholder")}
            className="min-h-20 rounded-2xl text-[13.5px] leading-relaxed"
          />
          <div className="mt-2.5 flex gap-2.5">
            <Button
              onClick={sendReply}
              disabled={!draft.trim() || reply.isPending}
              className="press h-11 flex-1 rounded-full text-[13px] font-semibold"
            >
              <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t("console.admin.support.sendReply")}
            </Button>
            <Button
              variant="outline"
              onClick={resolve}
              disabled={reply.isPending}
              className="press h-11 flex-1 rounded-full text-[13px] font-semibold"
            >
              <CheckCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t("console.admin.support.resolve")}
            </Button>
          </div>
        </div>
      ) : null}
    </motion.article>
  );
}

export default function SupportScreen() {
  const [filter, setFilter] = useState<Filter>("open");

  const query = useQuery({
    queryKey: ["admin", "support", filter],
    queryFn: async () => {
      if (filter === "all") return (await adminConsoleService.support()).tickets;
      if (filter === "resolved") return (await adminConsoleService.support("resolved")).tickets;
      // "Open" = not yet resolved: open + in_progress (two server filters)
      const [open, inProgress] = await Promise.all([
        adminConsoleService.support("open"),
        adminConsoleService.support("in_progress"),
      ]);
      return [...open.tickets, ...inProgress.tickets];
    },
    staleTime: 30_000,
  });

  const tickets = query.data ?? [];

  return (
    <ConsoleScreen
      title={t("console.admin.support.title")}
      subtitle={t("console.admin.support.subtitle")}
    >
      {/* server-side status filter chips */}
      <div
        role="tablist"
        aria-label={t("console.admin.support.title")}
        className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "press flex h-10 shrink-0 items-center rounded-full border px-4 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {t(f.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {query.isLoading ? (
          <PageSkeleton variant="list" />
        ) : query.isError ? (
          <ErrorState
            icon={LifeBuoy}
            title={t("console.common.loadError")}
            onRetry={() => query.refetch()}
          />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title={t("console.admin.support.empty")}
            body={t("console.admin.support.subtitle")}
          />
        ) : (
          <ul className="space-y-2.5">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConsoleScreen>
  );
}
