import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, requireUser, isAuthFailure, parseBody, isParseFailure } from "@/lib/api";
import { readingFailedText } from "../_lib/dto";

/**
 * POST /api/ask/speak — text-to-speech for an assistant reading.
 *
 * - The message must belong to one of the caller's conversations
 * - Only assistant messages that are not failed fallbacks can be spoken
 * - Text is cleaned and truncated at a sentence boundary (TTS limit 1024)
 * - Audio is generated server-side via z-ai-web-dev-sdk (never client-side)
 * - Small in-memory cache (message content is immutable once persisted)
 * → binary audio/wav body
 */

const bodySchema = z.object({ messageId: z.string().uuid() });

const TTS_MAX_CHARS = 1000; // API hard limit is 1024 — keep a safety margin

/** Speech-friendly cleanup: collapse whitespace, drop markdown-ish symbols. */
function prepareForSpeech(raw: string): string {
  return raw
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate at the last sentence boundary under the limit (no mid-word cuts). */
function truncateForSpeech(text: string): string {
  if (text.length <= TTS_MAX_CHARS) return text;
  const slice = text.slice(0, TTS_MAX_CHARS);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (lastStop > TTS_MAX_CHARS * 0.6) return slice.slice(0, lastStop + 1);
  return slice.trimEnd();
}

interface TtsShape {
  arrayBuffer: () => Promise<ArrayBuffer>;
}

// ------------------------------------------------------------- memory cache
// message content is immutable, so the audio can be cached per message id.
// Small LRU-ish cap — TTS takes seconds; replays should be instant.

const audioCache = new Map<string, Buffer>();
const AUDIO_CACHE_MAX = 24;

function cacheGet(key: string): Buffer | undefined {
  const hit = audioCache.get(key);
  if (hit) {
    // refresh recency
    audioCache.delete(key);
    audioCache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: Buffer): void {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, value);
  if (audioCache.size > AUDIO_CACHE_MAX) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  const message = await db.aiMessage.findUnique({
    where: { id: body.messageId },
    include: { conversation: { select: { userId: true } } },
  });
  if (!message || message.conversation.userId !== auth.user.id) {
    return fail(404, "not_found", "This reading doesn't exist.");
  }
  if (message.role !== "assistant") {
    return fail(422, "not_speakable", "Only Tara's readings can be listened to.");
  }
  if (message.content === readingFailedText()) {
    return fail(422, "not_speakable", "This reading can't be listened to.");
  }

  const text = truncateForSpeech(prepareForSpeech(message.content));
  if (!text) {
    return fail(422, "not_speakable", "This reading can't be listened to.");
  }

  const cached = cacheGet(message.id);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: { "Content-Type": "audio/wav", "Content-Length": String(cached.length) },
    });
  }

  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const response = (await zai.audio.tts.create({
      input: text,
      voice: "jam", // calm British voice — fits the English readings
      speed: 1,
      response_format: "wav", // mp3 is not served by the current TTS backend
      stream: false,
    })) as TtsShape;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    if (buffer.length === 0) {
      return fail(502, "tts_failed", "The voice service returned no audio. Please try again.");
    }

    cacheSet(message.id, buffer);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": "audio/wav", "Content-Length": String(buffer.length) },
    });
  } catch {
    return fail(502, "tts_failed", "The voice service is unavailable right now. Please try again.");
  }
}
