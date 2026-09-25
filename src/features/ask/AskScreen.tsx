"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowUp,
  Briefcase,
  Calendar,
  ChevronRight,
  Copy,
  Headphones,
  Heart,
  History,
  Hourglass,
  Loader2,
  Mic,
  MoonStar,
  Share2,
  Sparkles,
  Square,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "@/hooks/useSession";
import { useAppStore, useCurrentScreen } from "@/store/app";
import { t } from "@/i18n";
import { trackEvent } from "@/lib/analytics";
import { ApiError, errorMessage } from "@/lib/http";
import { aiService, type AiConversationSummaryDTO, type AskMessageDTO } from "@/services/ai";
import { ScreenScaffold } from "@/components/shared/ScreenScaffold";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TrustNote } from "@/components/shared/TrustNote";
import { DemoDataBadge } from "@/components/shared/DemoDataBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ constants

const CONV_STORAGE_KEY = "tara_ask_conversation";
const MAX_MESSAGE_LENGTH = 500;

const SUGGESTIONS: { icon: LucideIcon; label: string }[] = [
  { icon: Briefcase, label: t("ask.promptCareer") },
  { icon: Hourglass, label: t("ask.promptPhase") },
  { icon: Heart, label: t("ask.promptRelationships") },
  { icon: Calendar, label: t("ask.promptMonth") },
];

interface PendingExchange {
  question: string;
  status: "thinking" | "failed";
  error?: string;
}

// ------------------------------------------------------- speech recognition
// Minimal structural types — SpeechRecognition is not in the TS DOM lib and
// availability varies (webkit prefix). Everything is narrowed to unknown.

interface RecognitionResultItem {
  transcript: string;
}
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<RecognitionResultItem>>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

// ------------------------------------------------------------- audio playback
// One audio element for the whole screen — only one reading speaks at a time.

let sharedAudio: HTMLAudioElement | null = null;
function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

export type SpeakState = { id: string; status: "loading" | "playing" } | null;

// ------------------------------------------------------------------ screen

/**
 * AskScreen — the "Ask your chart" conversational assistant.
 * ChatGPT-style flow grounded in the user's pre-computed chart context.
 */
export default function AskScreen() {
  const me = useMe();
  const qc = useQueryClient();
  const push = useAppStore((s) => s.push);
  const openInTab = useAppStore((s) => s.openInTab);
  const screen = useCurrentScreen();
  const qParam = typeof screen.params?.q === "string" ? screen.params.q : undefined;

  const [input, setInput] = useState("");
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(CONV_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [pending, setPending] = useState<PendingExchange | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 1 | -1>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakState, setSpeakState] = useState<SpeakState>(null);

  const pendingRef = useRef<PendingExchange | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const speakTokenRef = useRef(0);

  const hasProfile = !!me.data?.primaryProfile;

  // ------------------------------------------------------------- data

  const conversations = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => aiService.conversations(),
    enabled: !!me.data?.user,
    staleTime: 30_000,
  });

  const messagesQuery = useQuery<AskMessageDTO[]>({
    queryKey: ["ai-messages", activeId],
    queryFn: async () => (await aiService.messages(activeId as string)).messages,
    enabled: !!activeId,
    staleTime: 30_000,
    retry: false,
  });

  const messages = activeId ? (messagesQuery.data ?? []) : [];
  const messagesLoading = !!activeId && messagesQuery.isLoading;
  const messagesError =
    !!activeId && messagesQuery.isError && !(messagesQuery.error instanceof ApiError && messagesQuery.error.code === "not_found");

  const activeConversation: AiConversationSummaryDTO | undefined = conversations.data?.conversations.find(
    (c) => c.id === activeId
  );

  // ------------------------------------------------------------- actions

  const setActive = useCallback((id: string | null) => {
    setActiveIdState(id);
    try {
      if (id) window.sessionStorage.setItem(CONV_STORAGE_KEY, id);
      else window.sessionStorage.removeItem(CONV_STORAGE_KEY);
    } catch {
      /* storage unavailable — conversation still works in-memory */
    }
  }, []);

  // A stored conversation that no longer exists (cleared) → soft reset.
  useEffect(() => {
    if (messagesQuery.error instanceof ApiError && messagesQuery.error.code === "not_found") {
      setActive(null);
    }
  }, [messagesQuery.error, setActive]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!question || pendingRef.current) return;
      setInput("");
      const exchange: PendingExchange = { question, status: "thinking" };
      pendingRef.current = exchange;
      setPending(exchange);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await aiService.ask(question, activeId ?? undefined, controller.signal);
        trackEvent("ai_question_asked");
        qc.setQueryData<AskMessageDTO[]>(["ai-messages", result.conversationId], (old) =>
          old ? [...old, ...result.messages] : [...result.messages]
        );
        setActive(result.conversationId);
        pendingRef.current = null;
        setPending(null);
        void qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      } catch (err) {
        const failure: PendingExchange = {
          question,
          status: "failed",
          error: isAbortError(err) ? t("ask.stopped") : errorMessage(err),
        };
        pendingRef.current = failure;
        setPending(failure);
      } finally {
        abortRef.current = null;
      }
    },
    [activeId, qc, setActive]
  );

  const retryPending = useCallback(() => {
    const current = pendingRef.current;
    if (!current || current.status !== "failed") return;
    pendingRef.current = null;
    setPending(null);
    void send(current.question);
  }, [send]);

  const stopThinking = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Home can navigate here with a prefilled question (params.q).
  useEffect(() => {
    if (autoSentRef.current) return;
    if (me.isLoading) return;
    const q = (qParam ?? "").trim();
    if (!q) return;
    autoSentRef.current = true;
    if (hasProfile) {
      void send(q);
    } else {
      setInput(q.slice(0, MAX_MESSAGE_LENGTH));
    }
  }, [me.isLoading, hasProfile, qParam, send]);

  const toggleFactors = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const sendFeedback = useCallback(async (messageId: string, value: 1 | -1) => {
    setFeedbackSent((prev) => ({ ...prev, [messageId]: value }));
    try {
      await aiService.feedback(messageId, value);
      toast(t("ask.thanksForFeedback"));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, []);

  const copyAnswer = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast(t("ask.copied"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }, []);

  const toggleListen = useCallback(
    async (messageId: string) => {
      const audio = getSharedAudio();

      // tap on the speaking/loading message → stop
      if (speakState?.id === messageId) {
        speakTokenRef.current += 1; // invalidate in-flight loads
        audio.pause();
        audio.removeAttribute("src"); // release the decoder
        setSpeakState(null);
        return;
      }

      // another message is speaking → switch
      speakTokenRef.current += 1;
      audio.pause();
      const token = speakTokenRef.current;
      setSpeakState({ id: messageId, status: "loading" });
      try {
        const url = await aiService.speak(messageId);
        if (token !== speakTokenRef.current) return; // superseded meanwhile
        audio.src = url;
        audio.onended = () => setSpeakState((s) => (s?.id === messageId ? null : s));
        audio.onerror = () => setSpeakState((s) => (s?.id === messageId ? null : s));
        await audio.play();
        if (token !== speakTokenRef.current) {
          audio.pause();
          return;
        }
        setSpeakState({ id: messageId, status: "playing" });
        trackEvent("reading_listened");
      } catch (err) {
        if (token !== speakTokenRef.current) return;
        setSpeakState(null);
        if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) return;
        toast.error(errorMessage(err));
      }
    },
    [speakState]
  );

  // stop the voice when leaving the screen
  useEffect(() => {
    return () => {
      speakTokenRef.current += 1;
      const audio = getSharedAudio();
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
    };
  }, []);

  const shareAnswer = useCallback(async (content: string) => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("common.appName"), text: content });
      } catch {
        /* user dismissed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      toast(t("ask.shareCopied"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  }, []);

  const loadConversation = useCallback(
    (id: string) => {
      setActive(id);
      setExpanded({});
      setHistoryOpen(false);
    },
    [setActive]
  );

  const startNew = useCallback(() => {
    setActive(null);
    setExpanded({});
  }, [setActive]);

  const clearAll = useCallback(async () => {
    try {
      await aiService.clearAll();
      qc.removeQueries({ queryKey: ["ai-messages"] });
      setActive(null);
      setHistoryOpen(false);
      void qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      toast(t("ask.clearedToast"));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [qc, setActive]);

  // ------------------------------------------------------------- voice input

  const toggleMic = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      toast(t("ask.voiceUnavailable"));
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      let transcript = "";
      const list = event.results;
      for (let i = list.length - 1; i >= 0; i--) {
        const alt = list[i]?.[0];
        if (alt?.transcript) {
          transcript = alt.transcript;
          break;
        }
      }
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}`.slice(0, MAX_MESSAGE_LENGTH) : transcript));
    };
    rec.onerror = () => {
      setListening(false);
      toast(t("ask.voiceUnavailable"));
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      toast(t("ask.voiceUnavailable"));
    }
  }, [listening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------- autoscroll / autosize

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const farFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 400;
    el.scrollTo({ top: el.scrollHeight, behavior: farFromBottom ? "auto" : "smooth" });
  }, [messages.length, pending?.question, pending?.status]);

  // ------------------------------------------------------------- render helpers

  const meReady = !me.isLoading;
  const noProfile = meReady && !hasProfile;
  const showEmpty = meReady && hasProfile && !pending && !messagesLoading && !messagesError && messages.length === 0;
  const hasAssistantReply = messages.some((m) => m.role === "assistant");
  const canSend = input.trim().length > 0 && pending === null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void send(input);
    }
  };

  return (
    <ScreenScaffold bare>
      {/* -------------------------------------------------- header */}
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2.5 pt-4 md:px-6">
        <div className="mx-auto flex w-full items-center justify-between gap-2 md:max-w-xl lg:max-w-[760px]">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("nav.ask")}</p>
            <h1 className="truncate font-display text-[19px] font-semibold leading-tight text-foreground">
              {activeConversation?.title ?? t("ask.title")}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <HeaderIconButton icon={SquarePen} label={t("ask.newChatAction")} onClick={startNew} />
            <HeaderIconButton icon={History} label={t("ask.history")} onClick={() => setHistoryOpen(true)} />
          </div>
        </div>
      </header>

      {/* -------------------------------------------------- message list */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("ask.title")}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6"
      >
        {/* centered chat column (chat token) — messages, empty state, errors */}
        <div className="mx-auto h-full w-full md:max-w-xl lg:max-w-[760px]">
          {noProfile ? (
            <EmptyState
              icon={MoonStar}
              title={t("ask.needProfileTitle")}
              body={t("ask.needProfile")}
              actionLabel={t("ask.needProfileCta")}
              onAction={() => push({ id: "profile.birthEdit", params: { mode: "create" } })}
            />
          ) : messagesLoading ? (
            <ConversationSkeleton />
          ) : messagesError ? (
            <ErrorState
              title={t("ask.errorTitle")}
              body={errorMessage(messagesQuery.error)}
              onRetry={() => void messagesQuery.refetch()}
            />
          ) : showEmpty ? (
            <EmptyAsk busy={pending !== null} onAsk={(q) => void send(q)} />
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} content={m.content} />
                ) : (
                  <AssistantCard
                    key={m.id}
                    m={m}
                    expanded={!!expanded[m.id]}
                    feedbackValue={feedbackSent[m.id]}
                    disabled={pending !== null}
                    speakState={speakState?.id === m.id ? speakState.status : "idle"}
                    retryQuestion={
                      m.failed && messages[i - 1]?.role === "user" ? messages[i - 1].content : undefined
                    }
                    onToggleFactors={toggleFactors}
                    onAsk={(q) => void send(q)}
                    onCopy={(c) => void copyAnswer(c)}
                    onListen={(id) => void toggleListen(id)}
                    onShare={(c) => void shareAnswer(c)}
                    onFeedback={(id, v) => void sendFeedback(id, v)}
                  />
                )
              )}
              {pending ? (
                <PendingView pending={pending} onStop={stopThinking} onRetry={retryPending} />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------------------------- talk to an astrologer */}
      {hasProfile && hasAssistantReply && !pending ? (
        <button
          type="button"
          onClick={() => openInTab("astrologers", { id: "astrologers.list" })}
          className="press mx-3 mb-1.5 flex shrink-0 items-center gap-3 rounded-2xl border border-dashed border-hairline bg-secondary/50 p-3 text-left hover:bg-secondary md:mx-auto md:w-full md:max-w-xl lg:max-w-[760px]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-foreground">{t("common.talkToAstrologer")}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{t("ask.talkToAstrologerBody")}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ) : null}

      {/* -------------------------------------------------- composer */}
      {hasProfile ? (
        <div className="mb-[calc(88px+env(safe-area-inset-bottom))] shrink-0 border-t border-hairline bg-background px-3 pb-2 pt-2.5 md:mb-0 md:px-6">
          {/* centered chat column — composer aligns with the conversation above */}
          <div className="mx-auto w-full md:max-w-xl lg:max-w-[760px]">
            <div
              className={cn(
                "flex items-end gap-1.5 rounded-3xl border border-hairline bg-card px-1.5 py-1.5",
                listening ? "border-primary/50 ring-2 ring-primary/15" : "focus-within:border-primary/40"
              )}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? t("ask.listening") : t("ask.inputPlaceholder")}
                aria-label={t("ask.inputPlaceholder")}
                className="scroll-thin max-h-[120px] min-h-11 w-full flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={toggleMic}
                aria-label={t("ask.voiceLabel")}
                className={cn(
                  "press flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                  listening
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Mic className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={!canSend}
                aria-label={t("ask.send")}
                className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20 transition-opacity disabled:opacity-35"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------- history sheet */}
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        query={conversations}
        activeId={activeId}
        onLoad={loadConversation}
        onClear={() => void clearAll()}
      />
    </ScreenScaffold>
  );
}

// ------------------------------------------------------------------ pieces

function HeaderIconButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="press flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-card text-foreground hover:bg-secondary"
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}

function EmptyAsk({ busy, onAsk }: { busy: boolean; onAsk: (question: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-1 pb-4 pt-2 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Sparkles className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight tracking-tight text-foreground">
        {t("ask.emptyTitle")}
      </h2>
      <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground md:max-w-[420px]">
        {t("ask.emptyBody")}
      </p>

      <div className="mt-7 w-full max-w-[380px] space-y-2 md:max-w-[560px]">
        <p className="px-1 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("ask.suggested")}
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {SUGGESTIONS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              disabled={busy}
              onClick={() => onAsk(label)}
              className="press flex w-full items-center gap-3 rounded-2xl border border-hairline bg-card p-3.5 text-left hover:bg-secondary disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-foreground">{label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <TrustNote variant="info" className="mt-6 w-full max-w-[380px] border-l-2 border-l-primary/40 bg-secondary/60 md:max-w-[560px]">
        {t("ask.disclaimer")}
      </TrustNote>
    </div>
  );
}

// ------------------------------------------------------------ term highlighting

/** Astrological key terms that get quiet emphasis inside readings. */
const TERM_RE = new RegExp(
  [
    "\\b(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu)\\b", // planets
    "\\b([1-9]|1[0-2])(st|nd|rd|th)\\s+(house|House)\\b", // houses
    "\\bmahadasha\\b|\\bantardasha\\b|\\bdasha\\b", // life phases
    "\\bnakshatra\\b|\\bascendant\\b|\\btransit(s)?\\b", // chart vocabulary
  ].join("|"),
  "g"
);

/** Renders reading text with key astrological terms quietly bolded. */
function HighlightedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TERM_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(
      <strong key={index} className="font-semibold text-foreground">
        {match[0]}
      </strong>
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function ConversationSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-44 rounded-2xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-2xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="msg-in flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground">
        {content}
      </div>
    </div>
  );
}

function ThinkingIndicator({ onStop }: { onStop: () => void }) {
  return (
    <div className="msg-in flex items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2.5" aria-label={t("ask.thinking")}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/70"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
        <span className="ml-1 text-[12.5px] font-medium text-muted-foreground">{t("ask.thinking")}</span>
      </div>
      <button
        type="button"
        onClick={onStop}
        className="press flex h-11 items-center rounded-full border border-hairline bg-card px-4 text-[12.5px] font-medium text-foreground hover:bg-secondary"
      >
        {t("ask.stop")}
      </button>
    </div>
  );
}

function PendingView({
  pending,
  onStop,
  onRetry,
}: {
  pending: PendingExchange;
  onStop: () => void;
  onRetry: () => void;
}) {
  return (
    <>
      <UserBubble content={pending.question} />
      {pending.status === "thinking" ? (
        <ThinkingIndicator onStop={onStop} />
      ) : (
        <div className="msg-in max-w-[92%] rounded-2xl rounded-tl-md border border-destructive/25 bg-destructive/5 px-4 py-3" role="alert">
          <p className="text-[13.5px] font-medium leading-relaxed text-foreground">{pending.error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="press mt-2 inline-flex h-9 items-center rounded-full px-1 text-[12.5px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("common.retry")}
          </button>
        </div>
      )}
    </>
  );
}

function AssistantCard({
  m,
  expanded,
  feedbackValue,
  disabled,
  speakState,
  retryQuestion,
  onToggleFactors,
  onAsk,
  onCopy,
  onListen,
  onShare,
  onFeedback,
}: {
  m: AskMessageDTO;
  expanded: boolean;
  feedbackValue: 1 | -1 | undefined;
  disabled: boolean;
  speakState: "idle" | "loading" | "playing";
  retryQuestion: string | undefined;
  onToggleFactors: (id: string) => void;
  onAsk: (question: string) => void;
  onCopy: (content: string) => void;
  onListen: (messageId: string) => void;
  onShare: (content: string) => void;
  onFeedback: (messageId: string, value: 1 | -1) => void;
}) {
  const factors = m.factors ?? [];
  const followUps = (m.followUps ?? []).slice(0, 3);
  return (
    <article className="msg-in max-w-[94%]">
      <div className="rounded-2xl rounded-tl-md border border-hairline bg-card p-4">
        {/* disclosure row */}
        {!m.failed ? (
          <button
            type="button"
            onClick={() => onToggleFactors(m.id)}
            aria-expanded={expanded}
            className="press -mx-1 -mt-1 flex w-full items-center justify-between gap-2 rounded-lg px-1 pt-1 text-left"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              {t("common.basedOnYourChart")}
            </span>
            <span className="text-[12px] font-medium text-muted-foreground">{t("common.why")}</span>
          </button>
        ) : null}

        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.7] text-foreground">
          <HighlightedText text={m.content} />
        </p>

        {/* factors panel */}
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="factors"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl bg-secondary/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {t("ask.factorsTitle")}
                  </p>
                  <DemoDataBadge />
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground/85">{t("ask.factorsBody")}</p>
                <div className="mt-2.5 space-y-1.5">
                  {factors.length > 0 ? (
                    factors.map((f) => (
                      <div key={`${f.label}-${f.value}`} className="flex items-baseline justify-between gap-3">
                        <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{f.label}</span>
                        <span className="text-right text-[12px] font-semibold text-foreground">{f.value}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground">{t("ask.factorsBody")}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* follow-up chips */}
        {followUps.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("ask.followUps")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAsk(q)}
                  className="press rounded-full border border-primary/25 bg-primary/5 px-3.5 py-2 text-[12px] font-medium text-foreground/90 transition-colors hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* actions */}
        <div className="mt-3.5 flex items-center gap-1 border-t border-hairline/60 pt-2.5">
          {!m.failed ? (
            <button
              type="button"
              onClick={() => onListen(m.id)}
              aria-label={speakState === "playing" ? t("ask.stopListen") : speakState === "loading" ? t("ask.listenLoading") : t("ask.listen")}
              title={speakState === "playing" ? t("ask.stopListen") : t("ask.listen")}
              aria-pressed={speakState === "playing"}
              className={cn(
                "press flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                speakState !== "idle" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {speakState === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : speakState === "playing" ? (
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <Square className="h-3.5 w-3.5 fill-primary" strokeWidth={1.75} />
                  <span className="absolute -right-1.5 flex h-2 items-end gap-[2px]" aria-hidden>
                    <span className="w-[2.5px] animate-[soundbar_0.9s_ease-in-out_infinite] rounded-full bg-primary" style={{ height: "6px", animationDelay: "0ms" }} />
                    <span className="w-[2.5px] animate-[soundbar_0.9s_ease-in-out_infinite] rounded-full bg-primary" style={{ height: "9px", animationDelay: "150ms" }} />
                  </span>
                </span>
              ) : (
                <Headphones className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          ) : null}
          <ActionIconButton icon={Copy} label={t("ask.copy")} onClick={() => onCopy(m.content)} />
          <ActionIconButton icon={Share2} label={t("ask.share")} onClick={() => onShare(m.content)} />
          <span className="mx-1 h-4 w-px bg-hairline" aria-hidden="true" />
          <ActionIconButton
            icon={ThumbsUp}
            label={t("ask.feedbackHelpful")}
            active={feedbackValue === 1}
            onClick={() => onFeedback(m.id, 1)}
          />
          <ActionIconButton
            icon={ThumbsDown}
            label={t("ask.feedbackNotHelpful")}
            active={feedbackValue === -1}
            onClick={() => onFeedback(m.id, -1)}
          />
          {retryQuestion ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAsk(retryQuestion)}
              className="press ml-auto mr-1 inline-flex h-9 items-center rounded-full text-[12.5px] font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50"
            >
              {t("common.retry")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ActionIconButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "press flex h-10 w-10 items-center justify-center rounded-full transition-colors",
        active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

function HistorySheet({
  open,
  onOpenChange,
  query,
  activeId,
  onLoad,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: { isLoading: boolean; data: { conversations: AiConversationSummaryDTO[] } | undefined };
  activeId: string | null;
  onLoad: (id: string) => void;
  onClear: () => void;
}) {
  const list = query.data?.conversations ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-[350px]">
        <SheetHeader className="border-b border-hairline pb-3">
          <SheetTitle className="font-display text-[17px] font-semibold">{t("ask.history")}</SheetTitle>
          <SheetDescription>{t("ask.historyBody")}</SheetDescription>
        </SheetHeader>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          {query.isLoading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : list.length === 0 ? (
            <p className="px-2 py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
              {t("ask.historyEmpty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onLoad(c.id)}
                    className={cn(
                      "press w-full rounded-2xl border border-hairline bg-card p-3.5 text-left hover:bg-secondary",
                      c.id === activeId && "border-primary/40 bg-accent/40"
                    )}
                  >
                    <p className="line-clamp-2 text-[13.5px] font-medium leading-snug text-foreground">{c.title}</p>
                    <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                      {" · "}
                      {c.messageCount === 1 ? t("ask.messagesOne") : t("ask.messagesMany", { count: c.messageCount })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="border-t border-hairline">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={list.length === 0}
                className="h-11 w-full rounded-2xl text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                {t("ask.clearAll")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("ask.clearConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("ask.clearConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 rounded-full px-6">{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClear}
                  className="h-11 rounded-full bg-destructive px-6 text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("ask.clearConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
