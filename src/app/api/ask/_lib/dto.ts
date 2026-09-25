import { t } from "@/i18n";
import type { AiMessageDTO } from "@/types/models";
import type { AiMessage } from "@prisma/client";

/**
 * Shared DTO helpers for /api/ask routes. Private folder (underscore) —
 * excluded from Next.js routing, internal use only.
 */

export type Factor = { label: string; value: string };

/** The graceful-fallback text persisted when a reading could not complete. */
export function readingFailedText(): string {
  return t("ask.readingFailed");
}

function safeFactors(json: string | null): Factor[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const factors = parsed
      .map((f): Factor | null => {
        if (typeof f !== "object" || f === null) return null;
        const rec = f as Record<string, unknown>;
        const label = typeof rec.label === "string" ? rec.label : "";
        const value = typeof rec.value === "string" ? rec.value : "";
        return label && value ? { label, value } : null;
      })
      .filter((f): f is Factor => f !== null);
    return factors.length ? factors : null;
  } catch {
    return null;
  }
}

function safeFollowUps(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const list = parsed.filter((f): f is string => typeof f === "string" && f.trim().length > 0);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export interface AskMessageRowDTO extends AiMessageDTO {
  /** true when this assistant reply is a graceful fallback (reading failed). */
  failed?: boolean;
}

export function toDto(m: AiMessage): AskMessageRowDTO {
  const failed = m.role === "assistant" && m.factorsJson === null && m.content === readingFailedText();
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    factors: safeFactors(m.factorsJson),
    followUps: safeFollowUps(m.followUpsJson),
    createdAt: m.createdAt.toISOString(),
    ...(failed ? { failed: true } : {}),
  };
}
