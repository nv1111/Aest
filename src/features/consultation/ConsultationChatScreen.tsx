"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Check,
  CheckCheck,
  FlaskConical,
  Loader2,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
  Video,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { consultationsService } from "@/services/consultations";
import { useMe } from "@/hooks/useSession";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { trackEvent } from "@/lib/analytics";
import { ApiError, errorMessage } from "@/lib/http";
import { formatINR, formatTimeIN } from "@/lib/money";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ConsultationDTO, MessageDTO } from "@/types/models";
import { useConsultationSocket, type SocketStatus } from "./useConsultationSocket";

/**
 * Consultation chat — full-height real-time surface. Everything billing-
 * critical stays visible: rate, running (approximate) charge, wallet
 * balance. Final amount is server-settled when the user ends.
 */

interface PendingMessage {
  localId: string;
  content: string;
  status: "pending" | "failed";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const MODE_ICON = { chat: MessageCircle, audio: Phone, video: Video } as const;

export default function ConsultationChatScreen() {
  const screen = useCurrentScreen();
  const id = screen.params?.id;
  const push = useAppStore((s) => s.push);
  const pop = useAppStore((s) => s.pop);
  const replace = useAppStore((s) => s.replace);
  const me = useMe();
  const qc = useQueryClient();

  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [endOpen, setEndOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  /** Phase 2 requested-lifecycle: declined (cancelled) local view */
  const [declined, setDeclined] = useState(false);
  const acceptedToastRef = useRef(false);

  const query = useQuery({
    queryKey: ["consultation", id],
    queryFn: () => consultationsService.get(id!),
    enabled: !!id,
  });

  const consultation = query.data?.consultation;
  const serverMessages: MessageDTO[] = useMemo(() => query.data?.messages ?? [], [query.data]);
  const isActive = consultation?.status === "active";
  const isRequested = consultation?.status === "requested";
  const isCancelled = consultation?.status === "cancelled" || declined;
  const rate = consultation?.ratePerMinute ?? 0;
  const balance = me.data?.wallet.balance ?? 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // append a server message to the query cache (dedupe by id)
  const appendMessage = useCallback(
    (m: MessageDTO) => {
      if (!id) return;
      qc.setQueryData<{ consultation: ConsultationDTO; messages: MessageDTO[] }>(
        ["consultation", id],
        (old) => {
          if (!old) return old;
          if (old.messages.some((x) => x.id === m.id)) return old;
          return { ...old, messages: [...old.messages, m] };
        }
      );
    },
    [qc, id]
  );

  const markAllUserRead = useCallback(
    (readAt: string) => {
      if (!id) return;
      qc.setQueryData<{ consultation: ConsultationDTO; messages: MessageDTO[] }>(
        ["consultation", id],
        (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((x) =>
                  x.senderRole === "user" && !x.readAt ? { ...x, readAt } : x
                ),
              }
            : old
      );
    },
    [qc, id]
  );

  // ------------------------------------------------------------- realtime
  // socket stays live while the request is PENDING too — the accept/decline
  // status event (and the greeting + billing system messages) arrive here.
  const { status } = useConsultationSocket(
    id,
    me.data?.user.id,
    !!id && !!me.data?.user.id && (isActive || isRequested),
    {
      onMessage: (m) => {
        appendMessage(m);
        if (m.senderRole === "astrologer" && id) {
          void consultationsService.markRead(id).catch(() => {});
        }
      },
      onTyping: (isTyping) => setTyping(isTyping),
      onRead: (readAt) => markAllUserRead(readAt),
      onEnded: () => {
        void qc.invalidateQueries({ queryKey: ["consultation", id] });
        void qc.invalidateQueries({ queryKey: ["me"] });
        void qc.invalidateQueries({ queryKey: ["consultations"] });
      },
      onStatus: (next) => {
        if (next === "active") {
          if (!acceptedToastRef.current) {
            acceptedToastRef.current = true;
            toast.success(
              t("consultation.acceptedToast", {
                name: query.data?.consultation?.astrologer.displayName ?? "",
              })
            );
          }
          // greeting + billing system messages also arrive via onMessage —
          // the refetch reconciles ids (dedupe) and the status fields.
          void query.refetch();
        } else if (next === "cancelled") {
          setDeclined(true);
          void qc.invalidateQueries({ queryKey: ["consultations"] });
        } else if (next === "ended") {
          void qc.invalidateQueries({ queryKey: ["consultation", id] });
          void qc.invalidateQueries({ queryKey: ["me"] });
          void qc.invalidateQueries({ queryKey: ["consultations"] });
        }
      },
    }
  );

  // mark astrologer messages read while the chat is open
  useEffect(() => {
    if (isActive && id && query.data) {
      void consultationsService.markRead(id).catch(() => {});
    }
  }, [isActive, id, query.data]);

  // billing meter ticks every second while active
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  // typing indicator safety clear (6s without events)
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setTyping(false), 6000);
    return () => clearTimeout(timer);
  }, [typing]);

  // auto-scroll when new messages arrive
  useEffect(() => {
    const total = serverMessages.length + pending.length + (typing ? 1 : 0);
    if (total === lastCountRef.current) return;
    lastCountRef.current = total;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [serverMessages.length, pending.length, typing]);

  // ------------------------------------------------------------ actions
  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !id || !isActive) return;
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setPending((p) => [...p, { localId, content: text, status: "pending" }]);
      setDraft("");
      try {
        const { message } = await consultationsService.sendMessage(id, text);
        setPending((p) => p.filter((x) => x.localId !== localId));
        appendMessage(message);
      } catch (err) {
        setPending((p) => p.map((x) => (x.localId === localId ? { ...x, status: "failed" } : x)));
        setDraft(text); // never lose typed content
        if (err instanceof ApiError && err.code === "insufficient_balance") {
          setInsufficientOpen(true);
          void qc.invalidateQueries({ queryKey: ["me"] });
        } else if (err instanceof ApiError && err.code === "not_accepted") {
          // request still pending — keep the muted composer + waiting banner,
          // no error toast spam (the message stays retryable)
        } else {
          toast.error(errorMessage(err));
        }
      }
    },
    [id, isActive, appendMessage, qc]
  );

  const retryMessage = useCallback(
    async (m: PendingMessage) => {
      if (!id) return;
      setPending((p) => p.map((x) => (x.localId === m.localId ? { ...x, status: "pending" } : x)));
      try {
        const { message } = await consultationsService.sendMessage(id, m.content);
        setPending((p) => p.filter((x) => x.localId !== m.localId));
        appendMessage(message);
      } catch (err) {
        setPending((p) => p.map((x) => (x.localId === m.localId ? { ...x, status: "failed" } : x)));
        if (err instanceof ApiError && err.code === "insufficient_balance") {
          setInsufficientOpen(true);
          void qc.invalidateQueries({ queryKey: ["me"] });
        } else if (err instanceof ApiError && err.code === "not_accepted") {
          // still waiting for acceptance — quiet
        } else {
          toast.error(errorMessage(err));
        }
      }
    },
    [id, appendMessage, qc]
  );

  const endConsultation = useCallback(async () => {
    if (!id || !isActive || ending) return;
    setEnding(true);
    try {
      await consultationsService.end(id);
      trackEvent("consultation_completed");
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["consultations"] });
      void qc.invalidateQueries({ queryKey: ["consultation", id] });
      replace({ id: "consultation.details", params: { id } });
    } catch (err) {
      toast.error(errorMessage(err));
      setEnding(false);
    }
  }, [id, isActive, ending, qc, replace]);

  const handleBack = () => {
    if (isActive) {
      setBackOpen(true);
      return;
    }
    pop();
  };

  // ------------------------------------------------------------ render
  if (!id) {
    return (
      <ScreenScaffold bare>
        <ErrorState title={t("common.errorGeneric")} />
      </ScreenScaffold>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenScaffold bare>
        <PageSkeleton variant="list" />
      </ScreenScaffold>
    );
  }

  if (query.isError || !consultation) {
    return (
      <ScreenScaffold bare>
        <ErrorState title={t("astrologers.notFoundTitle")} onRetry={() => query.refetch()} />
      </ScreenScaffold>
    );
  }

  const a = consultation.astrologer;
  const ModeIcon = MODE_ICON[(consultation.mode as keyof typeof MODE_ICON) ?? "chat"] ?? MessageCircle;

  const startedMs = consultation.startedAt ? new Date(consultation.startedAt).getTime() : null;
  const elapsedSec =
    isActive && startedMs
      ? Math.max(0, Math.floor((now - startedMs) / 1000))
      : consultation.durationSeconds ?? 0;
  const runningCharge = rate > 0 ? Math.max(1, Math.ceil(elapsedSec / 60)) * rate : 0;

  return (
    <ScreenScaffold bare>
      {/* ------------------------------------------------------------ header */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex w-full items-center gap-2 px-3 pt-2.5 pb-2 md:max-w-xl md:px-6 lg:max-w-[760px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t("common.back")}
            className="press flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => push({ id: "astrologers.profile", params: { id: a.id } })}
            className="press flex min-w-0 flex-1 items-center gap-2.5 text-left"
            aria-label={`${a.displayName} — ${t("astrologers.viewProfile")}`}
          >
            <div className="relative shrink-0">
              <Avatar className="h-9 w-9 rounded-xl border">
                <AvatarImage src={a.photoUrl ?? undefined} alt={a.displayName} />
                <AvatarFallback className="rounded-xl bg-secondary text-[12px] font-semibold text-secondary-foreground">
                  {initials(a.displayName)}
                </AvatarFallback>
              </Avatar>
              {a.onlineStatus === "online" ? (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" aria-label={t("common.online")} />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[14px] font-semibold leading-tight text-foreground">
                  {a.displayName}
                </p>
                <ModeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <p className="flex items-center gap-1 truncate text-[10.5px] leading-snug text-muted-foreground">
                <FlaskConical className="h-3 w-3 shrink-0" aria-hidden />
                {t("consultation.demoAstrologer")}
              </p>
            </div>
          </button>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/8 px-2.5 py-1 text-[12px] font-semibold text-primary">
            {formatINR(rate)}
            <span className="font-normal text-primary/70">{t("common.perMinute")}</span>
          </span>
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-3.5 text-[12.5px] font-medium text-destructive press"
              onClick={() => setEndOpen(true)}
            >
              {t("consultation.end")}
            </Button>
          ) : null}
        </div>

        {/* -------------------------------------------------- billing meter */}
        {isRequested ? (
          <div className="border-t border-primary/25 bg-primary/6 px-4 py-2.5" aria-live="polite">
            <div className="mx-auto flex w-full items-center gap-2 text-[12.5px] md:max-w-xl md:px-6 lg:max-w-[760px]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-foreground/85">
                {t("consultation.waitingAccept", { name: a.displayName })}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                {formatINR(balance)}
              </span>
            </div>
            <p className="mx-auto mt-0.5 w-full text-[10.5px] leading-snug text-muted-foreground md:max-w-xl md:px-6 lg:max-w-[760px]">
              {t("consultation.waitingNote", { name: a.displayName })}
            </p>
          </div>
        ) : isCancelled ? (
          <div className="border-t border-hairline bg-secondary/50 px-4 py-2.5">
            <p className="mx-auto w-full text-[12px] text-muted-foreground md:max-w-xl md:px-6 lg:max-w-[760px]">
              {t("consultation.noCharge")}
            </p>
          </div>
        ) : (
          <div className="border-t border-warning/30 bg-warning/10 px-4 py-2.5" aria-live="off">
            <div className="mx-auto flex w-full items-center justify-between gap-3 text-[12.5px] md:max-w-xl md:px-6 lg:max-w-[760px]">
              <span className="text-muted-foreground">
                {t("consultation.runningDuration")}{" "}
                <span className="font-semibold tabular-nums text-foreground">{mmss(elapsedSec)}</span>
              </span>
              <span className="text-muted-foreground">
                {t("consultation.runningCharge")}{" "}
                <span className="font-semibold text-foreground">
                  {isActive ? "≈ " : ""}
                  {formatINR(isActive ? runningCharge : consultation.totalAmount ?? 0)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                {formatINR(balance)}
              </span>
            </div>
            <p className="mx-auto mt-0.5 w-full text-[10.5px] leading-snug text-muted-foreground md:max-w-xl md:px-6 lg:max-w-[760px]">
              {isActive
                ? t("consultation.approxNote")
                : `${t("consultation.ended")} — ${formatINR(consultation.totalAmount ?? 0)}`}
            </p>
          </div>
        )}

        {/* --------------------------------------------- connection / ended */}
        <div className="mx-auto flex w-full items-center justify-between gap-2 px-4 py-1.5 text-[11.5px] md:max-w-xl md:px-6 lg:max-w-[760px]">
          <ConnectionChip status={isActive ? status : isRequested ? "connecting" : "offline"} />
          {!isActive ? (
            <button
              type="button"
              onClick={() => push({ id: "consultation.details", params: { id } })}
              className="press text-[11.5px] font-medium text-primary"
            >
              {t("consultation.viewDetails")}
            </button>
          ) : null}
        </div>
        {isActive && (status === "reconnecting" || status === "offline") ? (
          <div className="border-t border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-[11.5px] text-foreground/80">
            {t("consultation.reconnectBanner")}
          </div>
        ) : null}
      </header>

      {/* ------------------------------------------------------------ messages */}
      <div
        ref={scrollRef}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-label={t("consultation.chatTitle")}
      >
        <div className="mx-auto w-full md:max-w-xl md:px-6 lg:max-w-[760px]">
        {isRequested ? (
          <div className="mx-auto mb-3 flex max-w-[85%] items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2 text-center text-[12px] text-secondary-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            {t("consultation.waitingAccept", { name: a.displayName })}
          </div>
        ) : null}
        {isCancelled ? (
          <div className="mx-auto mb-3 max-w-[92%] rounded-2xl border border-warning/40 bg-warning/10 p-4 text-center">
            <p className="text-[13.5px] font-semibold text-foreground">
              {t("consultation.requestDeclinedTitle")}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {t("consultation.requestDeclinedBody", { name: a.displayName })}
            </p>
            <Button
              variant="outline"
              className="mt-3 h-10 rounded-full px-6 press"
              onClick={pop}
            >
              {t("consultation.requestDeclinedBack")}
            </Button>
          </div>
        ) : !isActive ? (
          <div className="mx-auto mb-3 max-w-[85%] rounded-xl bg-secondary px-3 py-2 text-center text-[12px] text-secondary-foreground">
            {t("consultation.endedBanner")}
          </div>
        ) : null}
        <div className="space-y-2.5">
          {serverMessages.map((m) => (
            <MessageRow key={m.id} m={m} astrologer={a} />
          ))}
          {pending.map((p) => (
            <PendingRow key={p.localId} p={p} onRetry={() => void retryMessage(p)} />
          ))}
          {typing && isActive ? <TypingBubble name={a.displayName} /> : null}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ input */}
      {isActive || isRequested ? (
        <div className="shrink-0 border-t bg-background px-3 py-2.5 mb-[calc(88px+env(safe-area-inset-bottom))] md:mb-0">
          <form
            className="mx-auto flex w-full items-end gap-2 md:max-w-xl md:px-6 lg:max-w-[760px]"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(draft);
            }}
          >
            <Textarea
              value={draft}
              disabled={isRequested}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(draft);
                }
              }}
              placeholder={
                isRequested
                  ? t("consultation.waitingAccept", { name: a.displayName })
                  : t("consultation.typeMessage")
              }
              aria-label={t("consultation.typeMessage")}
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-card py-2.5 text-[13.5px] disabled:cursor-default disabled:opacity-60"
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full press"
              disabled={isRequested || !draft.trim() || pending.some((p) => p.status === "pending")}
              aria-label={t("consultation.send")}
            >
              <Send className="h-4.5 w-4.5" aria-hidden />
            </Button>
          </form>
        </div>
      ) : (
        <div className="shrink-0 border-t bg-background px-4 py-3 mb-[calc(88px+env(safe-area-inset-bottom))] md:mb-0">
          <Button
            variant="outline"
            className="mx-auto h-11 w-full rounded-full press md:flex md:max-w-xl lg:max-w-[760px]"
            onClick={() => push({ id: "consultation.details", params: { id } })}
          >
            {t("consultation.viewDetails")}
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------- end dialog */}
      <AlertDialog open={endOpen} onOpenChange={setEndOpen}>
        <AlertDialogContent className="mx-auto max-w-[340px] rounded-3xl md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[17px] font-semibold">
              {t("consultation.endConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {t("consultation.endConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="h-11 flex-1 rounded-full">
              {t("consultation.endConfirmNo")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 flex-1 rounded-full press"
              onClick={(e) => {
                e.preventDefault();
                setEndOpen(false);
                void endConsultation();
              }}
            >
              {ending ? t("common.loading") : t("consultation.endConfirmYes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------------- back dialog */}
      <AlertDialog open={backOpen} onOpenChange={setBackOpen}>
        <AlertDialogContent className="mx-auto max-w-[340px] rounded-3xl md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[17px] font-semibold">
              {t("consultation.backTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {t("consultation.backBody", { rate: formatINR(rate) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="h-11 flex-1 rounded-full">
              {t("consultation.endConfirmNo")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 flex-1 rounded-full press"
              onClick={(e) => {
                e.preventDefault();
                setBackOpen(false);
                void endConsultation();
              }}
            >
              {t("consultation.backEnd")}
            </AlertDialogAction>
            <AlertDialogAction
              className="h-11 flex-1 rounded-full press"
              onClick={(e) => {
                e.preventDefault();
                setBackOpen(false);
                pop();
              }}
            >
              {t("consultation.backKeep")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------- insufficient sheet */}
      <Sheet open={insufficientOpen} onOpenChange={setInsufficientOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[430px] gap-0 rounded-t-3xl px-5 pb-5 pt-5 md:max-w-md"
        >
          <SheetHeader className="space-y-1 px-0 text-left">
            <SheetTitle className="font-display text-[17px] font-semibold">
              {t("consultation.insufficientTitle")}
            </SheetTitle>
            <SheetDescription className="text-[13px] leading-relaxed">
              {t("consultation.insufficientBody")}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex-row gap-2 px-0">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-full press"
              onClick={() => setInsufficientOpen(false)}
            >
              {t("consultation.closeLabel")}
            </Button>
            <Button
              className="h-11 flex-1 rounded-full press"
              onClick={() => {
                setInsufficientOpen(false);
                push({ id: "wallet.recharge" });
              }}
            >
              <Wallet className="mr-1.5 h-4 w-4" aria-hidden />
              {t("consultation.insufficientCta")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ScreenScaffold>
  );
}

// ---------------------------------------------------------------- pieces

function ConnectionChip({ status }: { status: SocketStatus }) {
  const map: Record<SocketStatus, { label: string; dot: string; text: string }> = {
    connected: { label: t("consultation.connected"), dot: "bg-success", text: "text-success" },
    connecting: { label: t("consultation.connecting"), dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
    reconnecting: { label: t("consultation.reconnecting"), dot: "bg-warning", text: "text-warning" },
    offline: { label: t("consultation.offline"), dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${s.text}`} role="status">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

function MessageRow({ m, astrologer }: { m: MessageDTO; astrologer: { displayName: string; photoUrl: string | null } }) {
  if (m.senderRole === "system") {
    return (
      <p className="mx-auto max-w-[85%] rounded-xl bg-secondary px-3 py-1.5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        {m.content}
      </p>
    );
  }

  const isUser = m.senderRole === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex max-w-[82%] items-end gap-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
        {!isUser ? (
          <Avatar className="h-7 w-7 rounded-full border">
            <AvatarImage src={astrologer.photoUrl ?? undefined} alt="" />
            <AvatarFallback className="rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
              {initials(astrologer.displayName)}
            </AvatarFallback>
          </Avatar>
        ) : null}
        <div className="min-w-0">
          <div
            className={
              isUser
                ? "rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground"
                : "rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground"
            }
          >
            {m.content}
          </div>
          <div
            className={`mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground ${isUser ? "justify-end" : ""}`}
          >
            <time dateTime={m.createdAt}>{formatTimeIN(m.createdAt)}</time>
            {isUser ? (
              m.readAt ? (
                <CheckCheck className="h-3.5 w-3.5 text-success" aria-label={t("consultation.readAria")} />
              ) : (
                <Check className="h-3.5 w-3.5" aria-label={t("consultation.sentAria")} />
              )
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PendingRow({ p, onRetry }: { p: PendingMessage; onRetry: () => void }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[82%] items-end gap-1.5 flex-row-reverse">
        <div className="min-w-0">
          <div
            className={`rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground ${
              p.status === "pending" ? "opacity-60" : "border-2 border-warning bg-warning/15"
            }`}
          >
            {p.content}
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10.5px] text-muted-foreground">
            {p.status === "pending" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t("consultation.sentAria")}…
              </>
            ) : (
              <>
                <span className="text-warning">{t("consultation.sendFailed")}</span>
                <button
                  type="button"
                  onClick={onRetry}
                  className="press inline-flex h-6 w-6 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                  aria-label={t("consultation.retrySend")}
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
      <span className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-card px-3.5 py-3" aria-label={t("consultation.typing", { name })}>
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
