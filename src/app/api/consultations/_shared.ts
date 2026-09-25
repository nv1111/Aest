import type { Astrologer, Consultation, Message } from "@prisma/client";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { buildChartContext, type ChartContext } from "@/lib/astrology/server";
import {
  relayMessage,
  relayTyping,
  relayAstrologerRead,
} from "@/lib/relay";

/**
 * Shared server-side consultation helpers (colocated under the
 * consultations route folder — underscore files are never routes).
 * DTO mappers, the astrologer AI persona, LLM reply/summary generation and
 * the scheduled reply pipeline all live here.
 */

export type ConsultationWithAstrologer = Consultation & { astrologer: Astrologer };

export function consultationDTO(c: ConsultationWithAstrologer) {
  const astrologer = {
    id: c.astrologer.id,
    displayName: c.astrologer.displayName,
    slug: c.astrologer.slug,
    photoUrl: c.astrologer.photoUrl,
    expertise: JSON.parse(c.astrologer.expertise) as string[],
    languages: JSON.parse(c.astrologer.languages) as string[],
    experienceYears: c.astrologer.experienceYears,
    rating: c.astrologer.rating,
    reviewCount: c.astrologer.reviewCount,
    consultationCount: c.astrologer.consultationCount,
    pricePerMinute: c.astrologer.pricePerMinute,
    isVerified: c.astrologer.isVerified,
    onlineStatus: c.astrologer.onlineStatus,
    availableFrom: c.astrologer.availableFrom?.toISOString() ?? null,
    about: c.astrologer.about,
    consultationModes: JSON.parse(c.astrologer.consultationModes) as string[],
  };
  return {
    id: c.id,
    astrologer,
    mode: c.mode,
    status: c.status,
    ratePerMinute: c.ratePerMinute,
    startedAt: c.startedAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    durationSeconds: c.durationSeconds,
    totalAmount: c.totalAmount,
    summary: c.summary,
    createdAt: c.createdAt.toISOString(),
  };
}

export function messageDTO(m: Message) {
  return {
    id: m.id,
    consultationId: m.consultationId,
    senderRole: m.senderRole,
    content: m.content,
    type: m.type,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Warm greeting persisted at start (template, no LLM). */
export function greetingMessage(a: Astrologer): string {
  const expertise = (JSON.parse(a.expertise) as string[]).slice(0, 3).join(", ");
  const languages = (JSON.parse(a.languages) as string[]).join(" and ");
  return (
    `Namaste, I'm ${a.displayName}. I've been practising for ${a.experienceYears} years, ` +
    `mostly ${expertise.toLowerCase()}, and I'm comfortable in ${languages}. ` +
    `I can see your birth chart basics in front of me. What would you like to focus on today — ` +
    `career, relationships, health, or something specific on your mind?`
  );
}

/** System billing line persisted at start. */
export function systemStartMessage(rate: number): string {
  return `Consultation started — rate ${formatINR(rate)}/min. You can end anytime.`;
}

// ------------------------------------------------------------------ LLM persona

interface CompletionShape {
  choices?: { message?: { content?: unknown } }[];
}

async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): Promise<string | null> {
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const completion = (await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    })) as CompletionShape;
    const text = completion.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

function personaPrompt(a: Astrologer, chart: ChartContext): string {
  const expertise = (JSON.parse(a.expertise) as string[]).join(", ");
  const languages = (JSON.parse(a.languages) as string[]).join(", ");
  return [
    `You are ${a.displayName}, a practicing Indian astrologer giving a paid consultation on the Tara platform.`,
    ``,
    `Your profile:`,
    `- ${a.experienceYears} years of experience`,
    `- Expertise: ${expertise}`,
    `- Languages you consult in: ${languages}`,
    `- About you: ${a.about}`,
    ``,
    `You are giving a paid consultation. Reply in the user's language (English default).`,
    `Warm, specific, honest. 60-140 words. Ground statements in the provided chart context.`,
    `Never guarantee outcomes, never fear-based, never push remedies or products.`,
    `If asked for precise predictions, be honest about uncertainty.`,
    ``,
    `User's chart context (the user consented to share this for this consultation only):`,
    JSON.stringify(chart, null, 2),
  ].join("\n");
}

/** Fallback when the LLM fails twice — grounded, honest about the hiccup. */
function fallbackReply(a: Astrologer, chart: ChartContext): string {
  const dasha = chart?.dasha?.mahadasha;
  const moon = chart?.chart?.moonSign;
  const focus = dasha
    ? `Your chart places you in a ${dasha} mahadasha — phases like this usually mix slow preparation with quiet progress, so treat restlessness as weather, not a verdict.`
    : `I'd rather look carefully at your specific placements than speak in generalities.`;
  return (
    `Thank you for sharing that. ${focus} ` +
    `Could you tell me the specific situation in a little more detail${moon ? ` — with your Moon in ${moon} in front of me, the emotional layer matters here` : ""}? ` +
    `(Forgive me — my connection flickered for a moment. If I missed anything, please repeat it.) ` +
    `— ${a.displayName}`
  );
}

async function generateReplyText(c: ConsultationWithAstrologer): Promise<string> {
  const recent = await db.message.findMany({
    where: { consultationId: c.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  recent.reverse();
  const chatMessages = recent
    .filter((m) => m.senderRole === "user" || m.senderRole === "astrologer")
    .map((m) => ({
      role: (m.senderRole === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  if (chatMessages.length === 0) return fallbackReply(c.astrologer, null);

  const chart = await buildChartContext(c.userId, null);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: personaPrompt(c.astrologer, chart) },
    ...chatMessages,
  ];

  // two attempts, then a graceful grounded fallback
  const first = await chatCompletion(messages);
  if (first) return first;
  const second = await chatCompletion(messages);
  if (second) return second;
  return fallbackReply(c.astrologer, chart);
}

/** Neutral 2-3 sentence summary of the whole conversation. */
async function generateSummaryText(
  c: ConsultationWithAstrologer,
  minutes: number
): Promise<string> {
  const messages = await db.message.findMany({
    where: { consultationId: c.id, senderRole: { in: ["user", "astrologer"] } },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  if (messages.length === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} with ${c.astrologer.displayName}. No messages were exchanged — nothing further was billed beyond the minimum.`;
  }

  const transcript = messages
    .map((m) => `${m.senderRole === "user" ? "User" : c.astrologer.displayName}: ${m.content}`)
    .join("\n");

  const prompt = [
    `Summarize this astrology consultation in 2-3 neutral sentences: what the user asked about and what guidance the astrologer offered.`,
    `Only reflect what was discussed — no new advice, no promises, no remedies.`,
    ``,
    transcript.slice(0, 6000),
  ].join("\n");

  const llm = await chatCompletion([
    { role: "system", content: prompt },
    { role: "user", content: "Write the summary now." },
  ]);
  if (llm) return llm;
  return `${minutes} minute${minutes === 1 ? "" : "s"} with ${c.astrologer.displayName}. The full transcript below preserves everything that was discussed.`;
}

/** Summary with a hard 8s ceiling so the end route never hangs. */
export async function generateSummary(
  c: ConsultationWithAstrologer,
  minutes: number
): Promise<string> {
  const result = await Promise.race([
    generateSummaryText(c, minutes),
    new Promise<string>((resolve) =>
      setTimeout(
        () =>
          resolve(
            `${minutes} minute${minutes === 1 ? "" : "s"} with ${c.astrologer.displayName}. The full transcript below preserves everything that was discussed.`
          ),
        8000
      )
    ),
  ]);
  return result;
}

// ------------------------------------------------- scheduled astrologer reply

interface ReplyScheduler {
  typingTimer: ReturnType<typeof setTimeout> | null;
  replyTimer: ReturnType<typeof setTimeout> | null;
}

const schedulers = new Map<string, ReplyScheduler>();

/**
 * Schedules the (AI-simulated) astrologer reply. Called WITHOUT awaiting the
 * response of the POST message route: typing indicator ~1.2s, reply after
 * 2.5–4s. Re-sends while a reply is pending reset the timers (the astrologer
 * "reads the new message first"), so bursts don't flood the chat.
 */
export function scheduleAstrologerReply(consultationId: string): void {
  const existing = schedulers.get(consultationId);
  if (existing) {
    if (existing.typingTimer) clearTimeout(existing.typingTimer);
    if (existing.replyTimer) clearTimeout(existing.replyTimer);
  }

  const state: ReplyScheduler = { typingTimer: null, replyTimer: null };
  state.typingTimer = setTimeout(() => {
    relayTyping(consultationId, true);
  }, 1200);

  const delay = 2500 + Math.floor(Math.random() * 1500);
  state.replyTimer = setTimeout(() => {
    schedulers.delete(consultationId);
    void deliverReply(consultationId);
  }, delay);

  schedulers.set(consultationId, state);
}

async function deliverReply(consultationId: string): Promise<void> {
  try {
    const consultation = await db.consultation.findUnique({
      where: { id: consultationId },
      include: { astrologer: true },
    });
    if (!consultation || consultation.status !== "active") {
      relayTyping(consultationId, false);
      return;
    }

    const text = await generateReplyText(consultation);
    // the consultation may have ended while the LLM was thinking
    const stillActive = await db.consultation.findUnique({
      where: { id: consultationId },
      select: { status: true },
    });
    if (!stillActive || stillActive.status !== "active") {
      relayTyping(consultationId, false);
      return;
    }

    const message = await db.message.create({
      data: {
        consultationId,
        senderRole: "astrologer",
        content: text,
        type: "text",
      },
    });

    // the astrologer has now read everything the user sent
    const readAt = new Date();
    await db.message.updateMany({
      where: { consultationId, senderRole: "user", readAt: null },
      data: { readAt },
    });

    relayMessage(consultationId, messageDTO(message));
    relayAstrologerRead(consultationId, readAt.toISOString());
    relayTyping(consultationId, false);
  } catch {
    relayTyping(consultationId, false);
  }
}
