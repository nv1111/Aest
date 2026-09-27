"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Loader2,
  MapPin,
  MessageCircle,
  MoonStar,
  Orbit,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { astrologerConsoleService } from "@/services/console";
import type { AstrologerContextDTO, ConsoleConsultationDTO } from "@/types/console";
import type { MessageDTO } from "@/types/models";
import { useMe } from "@/hooks/useSession";
import { useConsoleStore } from "@/store/console";
import { t } from "@/i18n";
import { formatINR, formatDateIN, formatDuration, formatTimeIN } from "@/lib/money";
import { errorMessage } from "@/lib/http";
import { ConsoleScreen } from "@/features/console/ConsoleScreen";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useConsoleChatSocket } from "./useConsoleChatSocket";
import { CustomerAvatar, LiveBadge, MODE_ICON, ReadTicks, RequestActions, statusLabel } from "./shared";

/**
 * Astrologer console → Chat (pushed, id "ast.chat" { consultationId }).
 *
 * The consultation room from the astrologer's side: bubbles (astrologer =
 * right/primary), accept/decline while the request is pending, composer with
 * typing broadcasts, the kundli context sheet (consent-flagged) and the end-
 * and-settle flow. Socket joins with the console user's own id.
 */

interface PendingMessage {
  localId: string;
  content: string;
  status: "pending" | "failed";
}

interface ChatQueryData {
  consultation: ConsoleConsultationDTO;
  messages: MessageDTO[];
}

const CHAT_COL = "mx-auto w-full md:max-w-xl md:px-6 lg:max-w-[760px]";

export default function ChatScreen({ consultationId }: { consultationId?: string }) {
  const me = useMe();
  const pop = useConsoleStore((s) => s.pop);
  const qc = useQueryClient();

  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [endOpen, setEndOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  /** optimistic status override (accept/end/socket events land instantly) */
  const [statusOverride, setStatusOverride] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["astrologer-console-chat", consultationId],
    queryFn: () => astrologerConsoleService.messages(consultationId!),
    enabled: !!consultationId,
  });

  const consultation = query.data?.consultation;
  const serverMessages: MessageDTO[] = useMemo(() => query.data?.messages ?? [], [query.data]);
  const status = statusOverride ?? consultation?.status ?? null;
  const isActive = status === "active";
  const isRequested = status === "requested";
  const isEnded = status === "ended";
  const isCancelled = status === "cancelled";
  const rate = consultation?.ratePerMinute ?? 0;
  const userId = me.data?.user.id;
  const astrologerName = me.data?.astrologerAccount?.displayName;

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // ------------------------------------------------------------- helpers

  const appendMessage = useCallback(
    (m: MessageDTO) => {
      if (!consultationId) return;
      qc.setQueryData<ChatQueryData>(["astrologer-console-chat", consultationId], (old) => {
        if (!old) return old;
        if (old.messages.some((x) => x.id === m.id)) return old;
        return { ...old, messages: [...old.messages, m] };
      });
    },
    [qc, consultationId]
  );

  const markOwnRead = useCallback(
    (readAt: string) => {
      if (!consultationId) return;
      qc.setQueryData<ChatQueryData>(["astrologer-console-chat", consultationId], (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((x) =>
                x.senderRole === "astrologer" && !x.readAt ? { ...x, readAt } : x
              ),
            }
          : old
      );
    },
    [qc, consultationId]
  );

  const refetchChat = useCallback(() => {
    if (!consultationId) return;
    void qc.invalidateQueries({ queryKey: ["astrologer-console-chat", consultationId] });
    void qc.invalidateQueries({ queryKey: ["astrologer-console-dashboard"] });
  }, [qc, consultationId]);

  // ------------------------------------------------------------- realtime

  const { status: socketStatus, sendTyping } = useConsoleChatSocket(consultationId, userId, !!consultationId && !!userId, {
    onMessage: (m) => {
      appendMessage(m);
      if (m.senderRole === "user") setTyping(false);
    },
    onTyping: (isTyping) => setTyping(isTyping),
    onRead: (readAt) => markOwnRead(readAt),
    onEnded: () => {
      setStatusOverride("ended");
      refetchChat();
    },
    onStatus: (next) => {
      setStatusOverride(next);
      refetchChat();
    },
  });

  // running duration ticks while active
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  // typing indicator safety clear (4s without events)
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(false), 4000);
    return () => clearTimeout(timer);
  }, [typing]);

  // typing broadcast: true on input (debounced), false after 2.5s idle
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<boolean>(false);

  const broadcastTyping = useCallback(
    (hasDraft: boolean) => {
      if (!isActive) return;
      if (hasDraft) {
        if (!lastSentRef.current) {
          lastSentRef.current = true;
          sendTyping(true);
        }
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          lastSentRef.current = false;
          sendTyping(false);
        }, 2500);
      } else if (lastSentRef.current) {
        lastSentRef.current = false;
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        sendTyping(false);
      }
    },
    [isActive, sendTyping]
  );

  useEffect(
    () => () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    },
    []
  );

  // auto-scroll when new content arrives (instant on far jump, smooth near bottom)
  useEffect(() => {
    const total = serverMessages.length + pending.length + (typing ? 1 : 0);
    if (total === lastCountRef.current) return;
    const first = lastCountRef.current === 0;
    lastCountRef.current = total;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    el.scrollTo({ top: el.scrollHeight, behavior: first || nearBottom ? "smooth" : "auto" });
  }, [serverMessages.length, pending.length, typing]);

  // ------------------------------------------------------------ actions

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !consultationId || !isActive) return;
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setPending((p) => [...p, { localId, content: text, status: "pending" }]);
      setDraft("");
      broadcastTyping(false);
      try {
        const { message } = await astrologerConsoleService.sendMessage(consultationId, text);
        setPending((p) => p.filter((x) => x.localId !== localId));
        appendMessage(message);
      } catch (err) {
        setPending((p) => p.map((x) => (x.localId === localId ? { ...x, status: "failed" } : x)));
        setDraft(text); // never lose typed content
        toast.error(errorMessage(err));
      }
    },
    [consultationId, isActive, appendMessage, broadcastTyping]
  );

  const retryMessage = useCallback(
    async (m: PendingMessage) => {
      if (!consultationId) return;
      setPending((p) => p.map((x) => (x.localId === m.localId ? { ...x, status: "pending" } : x)));
      try {
        const { message } = await astrologerConsoleService.sendMessage(consultationId, m.content);
        setPending((p) => p.filter((x) => x.localId !== m.localId));
        appendMessage(message);
      } catch (err) {
        setPending((p) => p.map((x) => (x.localId === m.localId ? { ...x, status: "failed" } : x)));
        toast.error(errorMessage(err));
      }
    },
    [consultationId, appendMessage]
  );

  const endMutation = useMutation({
    mutationFn: () => astrologerConsoleService.end(consultationId!),
    onSuccess: ({ consultation: updated }) => {
      setStatusOverride(updated.status);
      // patch the cache immediately — the socket "ended" event can flip the
      // banner before the refetch lands (₹0 flash race)
      qc.setQueryData<ChatQueryData>(["astrologer-console-chat", consultationId], (old) =>
        old ? { ...old, consultation: { ...old.consultation, ...updated } } : old
      );
      refetchChat();
      toast.success(t("console.chat.endedToast"));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // ------------------------------------------------------------ render

  if (!consultationId) {
    return (
      <ConsoleScreen bare title={t("console.chat.title")}>
        <ErrorState title={t("common.errorGeneric")} />
      </ConsoleScreen>
    );
  }

  if (query.isLoading) {
    return (
      <ConsoleScreen bare title={t("console.chat.title")}>
        <PageSkeleton variant="list" />
      </ConsoleScreen>
    );
  }

  if (query.isError || !consultation) {
    return (
      <ConsoleScreen bare title={t("console.chat.title")}>
        <ErrorState title={t("console.common.loadError")} onRetry={() => query.refetch()} />
      </ConsoleScreen>
    );
  }

  const name = consultation.user.name ?? t("console.chat.contextUser");
  const ModeIcon = MODE_ICON[(consultation.mode as keyof typeof MODE_ICON)] ?? MessageCircle;
  const startedMs = consultation.startedAt ? new Date(consultation.startedAt).getTime() : null;
  const elapsedSec =
    isActive && startedMs
      ? Math.max(0, Math.floor((now - startedMs) / 1000))
      : consultation.durationSeconds ?? 0;

  return (
    <ConsoleScreen bare title={t("console.chat.title")}>
      {/* ------------------------------------------------------------ header */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur-md">
        <div className={cn("flex items-center gap-2 px-3 pt-2.5 pb-2.5", CHAT_COL)}>
          <button
            type="button"
            onClick={pop}
            aria-label={t("common.back")}
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="relative shrink-0">
              <CustomerAvatar name={name} className="h-9 w-9" />
              {isActive ? (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-warning" aria-hidden />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[14px] font-semibold leading-tight text-foreground">{name}</p>
                <ModeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {isActive ? <LiveBadge /> : null}
              </div>
              <p className="truncate text-[10.5px] leading-snug text-muted-foreground">
                {(isActive || isRequested) && socketStatus === "connected"
                  ? t("consultation.connected")
                  : isActive || isRequested
                    ? t("consultation.connecting")
                    : statusLabel(status ?? "ended")}
                {" · "}
                {formatINR(rate)}
                {t("console.common.perMin")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium press"
            onClick={() => setContextOpen(true)}
          >
            <Orbit className="h-4 w-4" aria-hidden />
            <span className="ml-1.5">{t("console.chat.contextCta")}</span>
          </Button>
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium text-destructive press"
              onClick={() => setEndOpen(true)}
            >
              {t("console.chat.endAction")}
            </Button>
          ) : null}
        </div>

        {/* --------------------------------------------- status / billing strip */}
        {isRequested ? (
          <div className="border-t border-primary/25 bg-primary/6 px-4 py-2.5">
            <div className={cn("flex items-center gap-2 text-[12.5px] text-foreground/85", CHAT_COL)}>
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
              <p className="min-w-0 flex-1 truncate">{t("console.chat.waitingAccept")}</p>
            </div>
          </div>
        ) : isActive ? (
          <div className="border-t border-warning/30 bg-warning/10 px-4 py-2" aria-live="off">
            <div className={cn("flex items-center justify-between gap-3 text-[12.5px]", CHAT_COL)}>
              <span className="text-muted-foreground">
                {t("console.chat.billingNote", { rate: formatINR(rate) })}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatDuration(elapsedSec)}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      {/* ------------------------------------------------------------ messages */}
      <div
        ref={scrollRef}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-label={t("console.chat.messagesTitle")}
      >
        <div className={CHAT_COL}>
          {isRequested ? (
            <div className="mx-auto mb-3 max-w-[85%] rounded-xl bg-secondary px-3 py-2 text-center text-[12px] text-secondary-foreground">
              {t("console.chat.requestCard", { name })}
            </div>
          ) : null}
          {isEnded ? (
            <div className="mx-auto mb-3 max-w-[85%] rounded-xl bg-secondary px-3 py-2 text-center text-[12px] text-secondary-foreground">
              {consultation.totalAmount == null
                ? t("console.chat.endedSettling")
                : t("console.chat.endedBanner", {
                    amount: formatINR(consultation.totalAmount),
                    duration: formatDuration(consultation.durationSeconds ?? 0),
                  })}
            </div>
          ) : null}
          {isCancelled ? (
            <div className="mx-auto mb-3 max-w-[85%] rounded-xl bg-secondary px-3 py-2 text-center text-[12px] text-secondary-foreground">
              {t("console.chat.cancelledBanner")}
            </div>
          ) : null}

          {serverMessages.length === 0 && pending.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">{t("console.chat.empty")}</p>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {serverMessages.map((m) => (
                  <MessageRow key={m.id} m={m} name={name} />
                ))}
              </AnimatePresence>
              {pending.map((p) => (
                <PendingRow key={p.localId} p={p} onRetry={() => void retryMessage(p)} />
              ))}
              {typing && isActive ? <TypingBubble name={name} /> : null}
            </div>
          )}

          {/* accept / decline inline while the request is pending */}
          {isRequested ? (
            <div className="mt-4 rounded-2xl border border-primary/25 bg-card p-3.5 shadow-sm shadow-primary/5">
              <RequestActions
                consultation={consultation}
                size="sm"
                onAccepted={(c) => setStatusOverride(c.status)}
                onDeclined={(c) => setStatusOverride(c.status)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------------------ composer */}
      {isActive ? (
        <div className="shrink-0 border-t bg-background px-3 py-2.5 md:px-6">
          <form
            className={cn("flex w-full items-end gap-2", CHAT_COL)}
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(draft);
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                broadcastTyping(e.target.value.trim().length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(draft);
                }
              }}
              placeholder={t("console.chat.composerPlaceholder", { name: astrologerName ?? "" })}
              aria-label={t("console.chat.composerPlaceholder", { name: astrologerName ?? "" })}
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-card py-2.5 text-[13.5px]"
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full press"
              disabled={!draft.trim() || pending.some((p) => p.status === "pending")}
              aria-label={t("console.chat.send")}
            >
              <Send className="h-4.5 w-4.5" aria-hidden />
            </Button>
          </form>
        </div>
      ) : (
        <div className="shrink-0 border-t bg-background px-4 py-3">
          <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
            {isEnded
              ? consultation.totalAmount == null
                ? t("console.chat.endedSettling")
                : t("console.chat.endedBanner", {
                    amount: formatINR(consultation.totalAmount),
                    duration: formatDuration(consultation.durationSeconds ?? 0),
                  })
              : isCancelled
                ? t("console.chat.cancelledBanner")
                : t("console.chat.waitingAccept")}
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- end dialog */}
      <AlertDialog open={endOpen} onOpenChange={setEndOpen}>
        <AlertDialogContent className="mx-auto max-w-[340px] rounded-3xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[17px] font-semibold">
              {t("console.chat.endConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {t("console.chat.endConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="h-11 flex-1 rounded-full">
              {t("console.demo.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 flex-1 rounded-full press bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={(e) => {
                e.preventDefault();
                setEndOpen(false);
                endMutation.mutate();
              }}
            >
              {endMutation.isPending ? t("common.loading") : t("console.chat.endConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -------------------------------------------------------- context sheet */}
      <ContextSheet
        consultationId={consultationId}
        open={contextOpen}
        onOpenChange={setContextOpen}
      />
    </ConsoleScreen>
  );
}

// ---------------------------------------------------------------- pieces

function MessageRow({ m, name }: { m: MessageDTO; name: string }) {
  if (m.senderRole === "system") {
    return (
      <p className="mx-auto max-w-[85%] rounded-xl bg-secondary px-3 py-1.5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        {m.content}
      </p>
    );
  }

  const isAstrologer = m.senderRole === "astrologer";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex", isAstrologer ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex max-w-[82%] items-end gap-1.5", isAstrologer ? "flex-row-reverse" : "")}>
        {!isAstrologer ? <CustomerAvatar name={name} className="h-7 w-7" fallbackClassName="text-[10px]" /> : null}
        <div className="min-w-0">
          <div
            className={cn(
              "px-3.5 py-2.5 text-[13.5px] leading-relaxed",
              isAstrologer
                ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                : "rounded-2xl rounded-bl-md border bg-card text-foreground"
            )}
          >
            {m.content}
          </div>
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground",
              isAstrologer ? "justify-end" : ""
            )}
          >
            <time dateTime={m.createdAt}>{formatTimeIN(m.createdAt)}</time>
            {isAstrologer ? <ReadTicks read={!!m.readAt} /> : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PendingRow({ p, onRetry }: { p: PendingMessage; onRetry: () => void }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[82%] flex-row-reverse items-end gap-1.5">
        <div className="min-w-0">
          <div
            className={cn(
              "rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground",
              p.status === "pending" ? "bg-primary opacity-60" : "border-2 border-warning bg-warning/15 text-foreground"
            )}
          >
            {p.content}
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10.5px] text-muted-foreground">
            {p.status === "pending" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-label={t("console.chat.send")} />
              </>
            ) : (
              <>
                <span className="text-warning">{t("console.chat.messageFailed")}</span>
                <button
                  type="button"
                  onClick={onRetry}
                  className="press inline-flex h-6 w-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                  aria-label={t("common.retry")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-1.5">
      <span
        className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-card px-3.5 py-3"
        aria-label={t("console.chat.typing", { name })}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </span>
    </div>
  );
}

// -------------------------------------------------------- kundli context

function timeAccuracyLabel(accuracy: string): string {
  if (accuracy === "approximate") return t("console.chat.contextTimeApprox");
  if (accuracy === "unknown") return t("console.chat.contextTimeUnknown");
  return t("console.chat.contextTimeExact");
}

function ContextSheet({
  consultationId,
  open,
  onOpenChange,
}: {
  consultationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ["astrologer-console-context", consultationId],
    queryFn: () => astrologerConsoleService.context(consultationId),
    enabled: open,
  });
  const ctx = query.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md scroll-thin"
      >
        <SheetHeader className="space-y-1 border-b px-5 pb-3 pt-5">
          <SheetTitle className="font-display text-[17px] font-semibold">
            {t("console.chat.contextTitle")}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] leading-relaxed">
            {ctx?.consentShared === false
              ? t("console.chat.consentDenied")
              : t("console.chat.consentGranted")}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-8">
          {query.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-label={t("console.common.loading")} />
            </div>
          ) : query.isError ? (
            <div className="py-6">
              <ErrorState
                icon={MoonStar}
                title={t("console.chat.contextFailed")}
                onRetry={() => query.refetch()}
              />
            </div>
          ) : ctx ? (
            <ContextBody ctx={ctx} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContextBody({ ctx }: { ctx: AstrologerContextDTO }) {
  if (!ctx.consentShared) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-foreground">{t("console.chat.consentDenied")}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {ctx.user.name ?? t("console.chat.contextUser")}
          </p>
        </div>
      </div>
    );
  }

  const { profile, chart, dasha } = ctx;
  const highlights = chart
    ? [
        { label: t("console.chat.contextAscendant"), value: chart.ascendant },
        { label: t("console.chat.contextMoon"), value: `${chart.moonSign} · ${chart.nakshatra} ${chart.nakshatraPada}` },
        { label: t("console.chat.contextSun"), value: chart.sunSign },
      ]
    : [];

  return (
    <div className="mt-4 space-y-5">
      {/* profile block */}
      {profile ? (
        <section aria-label={t("console.chat.contextUser")}>
          <SectionHeader className="px-0">{t("console.chat.contextUser")}</SectionHeader>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <CustomerAvatar name={profile.name} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">{profile.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                  {t("console.chat.contextBorn")}{" "}
                  {new Date(profile.dateOfBirth).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {profile.timeOfBirth ? ` · ${profile.timeOfBirth} (${timeAccuracyLabel(profile.timeAccuracy)})` : ` · ${timeAccuracyLabel(profile.timeAccuracy)}`}
                </p>
                {profile.place ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{profile.place}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* chart highlights */}
      {chart ? (
        <section aria-label={t("console.chat.contextTitle")}>
          <SectionHeader className="px-0">{t("console.chat.contextNakshatra")}</SectionHeader>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {highlights.map((h) => (
              <div key={h.label} className="rounded-xl border bg-card p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {h.label}
                </p>
                <p className="mt-1 text-[13.5px] font-semibold leading-tight text-foreground">{h.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* dasha */}
      {dasha ? (
        <section aria-label={t("console.chat.contextDasha")}>
          <SectionHeader className="px-0">{t("console.chat.contextDasha")}</SectionHeader>
          <div className="rounded-2xl border border-primary/25 bg-primary/6 p-4">
            <p className="font-display text-[15px] font-semibold text-foreground">
              {t("console.chat.contextDashaValue", { maha: dasha.mahadasha, antar: dasha.antardasha })}
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {formatDateIN(dasha.antardashaEnds)} → {formatDateIN(dasha.mahadashaEnds)}
            </p>
          </div>
        </section>
      ) : null}

      {/* planets */}
      {chart && chart.planets.length > 0 ? (
        <section aria-label={t("console.chat.contextPlanets")}>
          <SectionHeader className="px-0">{t("console.chat.contextPlanets")}</SectionHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {chart.planets.map((pl) => (
              <div key={pl.planet} className="rounded-xl border bg-card p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">{pl.planet}</p>
                  {pl.retrograde ? (
                    <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9.5px] font-bold text-warning-foreground">
                      {t("console.chat.contextRetro")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{pl.sign}</p>
                <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                  {t("console.chat.contextHouseShort", { n: pl.house })} · {pl.degree.toFixed(1)}°
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
