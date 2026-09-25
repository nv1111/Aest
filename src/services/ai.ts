import { ApiError, http, type ApiEnvelope } from "@/lib/http";
import type { AiMessageDTO } from "@/types/models";

/**
 * aiService — the "Ask your chart" assistant. Client-side API access only;
 * every LLM call happens server-side in /api/ask/* (AGENTS.md §2.4).
 */

export interface AskMessageDTO extends AiMessageDTO {
  /** true when the assistant reply is a graceful fallback (reading failed server-side). */
  failed?: boolean;
}

export interface AiConversationSummaryDTO {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AskMessageResult {
  conversationId: string;
  /** [userMessage, assistantMessage] as persisted by the server */
  messages: AskMessageDTO[];
}

/**
 * POST with AbortSignal support (the shared http wrapper does not expose
 * signals yet — flagged in the worklog for a shared follow-up).
 * Follows the exact same envelope + error conventions as lib/http.
 */
async function postWithSignal<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "You seem to be offline. Please check your connection and retry.");
  }

  let parsed: ApiEnvelope<T> | null = null;
  try {
    parsed = (await res.json()) as ApiEnvelope<T>;
  } catch {
    parsed = null;
  }
  if (!res.ok || !parsed?.ok) {
    throw new ApiError(res.status, parsed?.error ?? "server_error", parsed?.message ?? "Something went wrong on our side. Please retry.");
  }
  return parsed.data as T;
}

export const aiService = {
  conversations: () =>
    http.get<{ conversations: AiConversationSummaryDTO[] }>("/api/ask/conversations"),

  messages: (conversationId: string) =>
    http.get<{ messages: AskMessageDTO[] }>(`/api/ask/messages?conversationId=${encodeURIComponent(conversationId)}`),

  ask: (message: string, conversationId?: string, signal?: AbortSignal, locale?: "en" | "hi") =>
    postWithSignal<AskMessageResult>("/api/ask/message", { message, conversationId, locale }, signal),

  feedback: (messageId: string, feedback: 1 | -1) =>
    postWithSignal<{ messageId: string; feedback: number }>("/api/ask/feedback", { messageId, feedback }),

  clearAll: () => postWithSignal<{ deleted: number }>("/api/ask/conversations/clear", {}),

  /** placeholder for future contextual deep-links from other features */
  interpret: (topic?: string) => postWithSignal<{ ok: boolean }>("/api/ask/interpret", { topic }),

  /**
   * Fetch the spoken version of an assistant reading (binary audio/mpeg).
   * Blob URLs are cached per message — replays don't refetch.
   */
  speak: async (messageId: string): Promise<string> => {
    const cachedUrl = speakUrlCache.get(messageId);
    if (cachedUrl) return cachedUrl;

    let res: Response;
    try {
      res = await fetch("/api/ask/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ messageId }),
      });
    } catch {
      throw new ApiError(0, "network", "You seem to be offline. Please check your connection and retry.");
    }

    if (!res.ok) {
      let parsed: { message?: string; error?: string } | null = null;
      try {
        parsed = (await res.json()) as { message?: string; error?: string };
      } catch {
        parsed = null;
      }
      throw new ApiError(res.status, parsed?.error ?? "tts_failed", parsed?.message ?? "The voice service is unavailable right now. Please try again.");
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      throw new ApiError(502, "tts_failed", "The voice service returned no audio. Please try again.");
    }
    const url = URL.createObjectURL(blob);
    speakUrlCache.set(messageId, url);
    if (speakUrlCache.size > 24) {
      // drop the oldest cached url (and release its blob)
      const oldest = speakUrlCache.keys().next().value;
      if (oldest !== undefined) {
        URL.revokeObjectURL(speakUrlCache.get(oldest) as string);
        speakUrlCache.delete(oldest);
      }
    }
    return url;
  },
};

const speakUrlCache = new Map<string, string>();
