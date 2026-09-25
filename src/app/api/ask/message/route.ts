import { NextRequest } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { buildChartContext, type ChartContext } from "@/lib/astrology/server";
import { toDto, readingFailedText, type Factor } from "../_lib/dto";

/**
 * POST /api/ask/message — the "Ask your chart" assistant turn.
 *
 * Trust principles (AGENTS.md §2.4 + §5): the LLM ONLY interprets the
 * pre-computed chart context from buildChartContext. It never does
 * astronomy math, never invents positions, never sells remedies.
 * All LLM access is server-side; keys never reach the client.
 */

const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  conversationId: z.string().uuid().optional(),
});

interface ModelAnswer {
  answer: string;
  followUps: string[];
  factors: Factor[];
}

const SYSTEM_PROMPT = `You are Tara, a warm, grounded Vedic astrology (jyotish) guide inside a calm mobile app. You explain astrology in simple, everyday Indian English that a first-time user understands.

You will receive the user's CHART CONTEXT as JSON (birth details, planets and houses, current dasha periods, transits). It is the ONLY astrology data you may use.

Rules you must follow:
1. Ground every answer in the given chart context — the dasha, the transits, and the planet/house placements provided. NEVER invent positions, signs, dates or periods that are not in the context. NEVER do your own astronomical calculations. If the context does not cover something, say so gently and interpret what IS given.
2. Tone: calm, kind, patient. No fear, no urgency, no doom. Never guarantee outcomes. Use hedged language such as "traditional astrology interprets this as…". Never give medical, legal or financial directives — for those topics, gently suggest consulting a qualified professional.
3. Never recommend remedies that require buying anything. At most mention simple optional traditional customs.
4. Keep answers short: 2 to 4 short paragraphs, at most about 180 words. Use simple words; briefly explain any astrology term you mention.
5. followUps: exactly 3 short, natural follow-up questions the user might ask next, each under 60 characters, in plain text.
6. factors: the 2 to 4 chart elements from the context that you actually used, each as {"label","value"} — e.g. {"label":"Current Mahadasha","value":"Saturn (until 2031)"} or {"label":"Jupiter transit","value":"Transiting 10th house"}.

Reply with STRICT JSON only — no markdown fences, no commentary before or after. The exact shape:
{"answer":"...","followUps":["...","...","..."],"factors":[{"label":"...","value":"..."}]}`;

// ------------------------------------------------------------- llm helpers

async function callLlm(turns: { role: "assistant" | "user"; content: string }[]): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: turns,
        thinking: { type: "disabled" },
      });
      const text = completion.choices[0]?.message?.content;
      if (typeof text === "string" && text.trim().length > 0) return text;
    } catch {
      // retry once on failure or empty output
    }
  }
  return null;
}

/** Defensive parse: strips fences, extracts the outermost object. */
function parseModelAnswer(raw: string): ModelAnswer | null {
  let text = raw.trim();
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const record = obj as Record<string, unknown>;
  const answer = typeof record.answer === "string" ? record.answer.trim() : "";
  if (!answer) return null;
  const followUps = Array.isArray(record.followUps)
    ? record.followUps
        .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        .map((f) => f.trim())
        .slice(0, 3)
    : [];
  const factors = Array.isArray(record.factors)
    ? record.factors
        .map((f): Factor | null => {
          if (typeof f !== "object" || f === null) return null;
          const rec = f as Record<string, unknown>;
          const label = typeof rec.label === "string" ? rec.label.trim() : "";
          const value = typeof rec.value === "string" ? rec.value.trim() : "";
          return label && value ? { label, value } : null;
        })
        .filter((f): f is Factor => f !== null)
        .slice(0, 4)
    : [];
  return { answer, followUps, factors };
}

/** Factors derived directly from the context when the model didn't return usable JSON. */
function fallbackFactors(ctx: NonNullable<ChartContext>): Factor[] {
  const factors: Factor[] = [];
  const year = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const y = new Date(iso).getFullYear();
    return Number.isNaN(y) ? "" : String(y);
  };
  if (ctx.dasha) {
    const mEnd = year(ctx.dasha.mahadashaEnds);
    const aEnd = year(ctx.dasha.antardashaEnds);
    factors.push({
      label: "Current Mahadasha",
      value: mEnd ? `${ctx.dasha.mahadasha} (until ${mEnd})` : ctx.dasha.mahadasha,
    });
    factors.push({
      label: "Current Antardasha",
      value: aEnd ? `${ctx.dasha.antardasha} (until ${aEnd})` : ctx.dasha.antardasha,
    });
  }
  const jupiter = ctx.transit?.jupiter;
  if (jupiter) {
    factors.push({
      label: "Jupiter transit",
      value: `Transiting house ${jupiter.natalHouse} in ${jupiter.currentSign}`,
    });
  }
  const saturn = ctx.transit?.saturn;
  if (saturn) {
    factors.push({
      label: "Saturn transit",
      value: `Transiting house ${saturn.natalHouse} in ${saturn.currentSign}`,
    });
  }
  return factors.slice(0, 4);
}

// ------------------------------------------------------------- route

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;
  const user = auth.user;

  // Chart context is a hard requirement — the assistant never guesses.
  const chartContext = await buildChartContext(user.id);
  if (!chartContext) {
    return fail(409, "no_profile", "Add your birth details so answers can be based on your chart.");
  }

  // Resolve the conversation (own rows only) or create a new one.
  let conversation =
    body.conversationId !== undefined
      ? await db.aiConversation.findFirst({ where: { id: body.conversationId, userId: user.id } })
      : null;
  if (body.conversationId !== undefined && !conversation) {
    return fail(404, "not_found", "This conversation is no longer available.");
  }
  if (!conversation) {
    conversation = await db.aiConversation.create({
      data: {
        userId: user.id,
        title: body.message.slice(0, 48),
      },
    });
  }

  // Persist the user message first (kept even if the reading fails).
  const userMsg = await db.aiMessage.create({
    data: { conversationId: conversation.id, role: "user", content: body.message },
  });

  // Last 10 prior messages for conversational context.
  const priorRows = await db.aiMessage.findMany({
    where: { conversationId: conversation.id, id: { not: userMsg.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const priorTurns = priorRows
    .slice()
    .reverse()
    .map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  const turns: { role: "assistant" | "user"; content: string }[] = [
    {
      role: "assistant",
      content: `${SYSTEM_PROMPT}\n\nUSER'S CHART CONTEXT (the only astrology data you may use):\n${JSON.stringify(chartContext)}`,
    },
    ...priorTurns,
    { role: "user", content: body.message },
  ];

  const raw = await callLlm(turns);

  let answer: string;
  let followUps: string[] | null = null;
  let factors: Factor[] | null = null;
  let failed = false;

  if (raw) {
    const parsed = parseModelAnswer(raw);
    if (parsed) {
      answer = parsed.answer;
      followUps = parsed.followUps.length ? parsed.followUps : null;
      factors = parsed.factors.length ? parsed.factors : fallbackFactors(chartContext);
    } else {
      // Model replied with non-JSON text — use it as the plain answer,
      // with honest factors derived from the actual context.
      answer = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      factors = fallbackFactors(chartContext);
    }
  } else {
    answer = readingFailedText();
    failed = true;
  }

  const assistantMsg = await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: answer,
      factorsJson: factors ? JSON.stringify(factors) : null,
      followUpsJson: followUps ? JSON.stringify(followUps) : null,
    },
  });
  await db.aiConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return ok({
    conversationId: conversation.id,
    messages: [toDto(userMsg), { ...toDto(assistantMsg), failed }],
  });
}
