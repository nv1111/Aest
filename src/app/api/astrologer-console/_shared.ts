import type { NextResponse } from "next/server";
import type { Astrologer, AstrologerAccount, Consultation, User } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePersona, isAuthFailure, fail, type SessionUser } from "@/lib/api";
import type { ConsoleConsultationDTO } from "@/types/console";

/**
 * Shared helpers for the astrologer-console API routes
 * (/api/astrologer-console/**). Underscore files are never routes.
 *
 * Every console route:
 * 1. requirePersona("astrologer") — 403 unless the demo persona (or real role)
 *    is active — the customer persona can never reach these routes
 * 2. resolves the caller's operated astrologer via AstrologerAccount
 *    (409 "no_account" when none is linked)
 * 3. verifies consultation OWNERSHIP (astrologerId === account.astrologerId)
 */

export type AccountWithAstrologer = AstrologerAccount & { astrologer: Astrologer };

export type ConsoleGuard =
  | { user: SessionUser; account: AccountWithAstrologer }
  | { response: NextResponse };

/** Persona guard + linked astrologer account resolution. */
export async function requireConsoleAstrologer(): Promise<ConsoleGuard> {
  const auth = await requirePersona("astrologer");
  if (isAuthFailure(auth)) return { response: auth.response };

  const account = await db.astrologerAccount.findUnique({
    where: { userId: auth.user.id },
    include: { astrologer: true },
  });
  if (!account) {
    return {
      response: fail(
        409,
        "no_account",
        "No astrologer profile is linked to this persona yet. Pick a demo astrologer in the console switcher first."
      ),
    };
  }
  return { user: auth.user, account };
}

/** Discriminator for the guard result (isAuthFailure also matches this shape). */
export function isGuardFailure(guard: ConsoleGuard): guard is { response: NextResponse } {
  return "response" in guard;
}

// ------------------------------------------------------------------ DTO mapper

export type ConsoleConsultationRow = Consultation & {
  user: Pick<User, "id" | "name" | "phone">;
  _count: { messages: number };
};

/** The include shape every console consultation query uses. */
export const consoleConsultationInclude = {
  user: { select: { id: true, name: true, phone: true } },
  _count: { select: { messages: true } },
} as const;

export function consoleConsultationDTO(c: ConsoleConsultationRow): ConsoleConsultationDTO {
  return {
    id: c.id,
    user: { id: c.user.id, name: c.user.name, phone: c.user.phone },
    mode: c.mode,
    status: c.status,
    ratePerMinute: c.ratePerMinute,
    startedAt: c.startedAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    durationSeconds: c.durationSeconds,
    totalAmount: c.totalAmount,
    summary: c.summary,
    userConsentShared: c.userConsentShared,
    createdAt: c.createdAt.toISOString(),
    messageCount: c._count.messages,
  };
}
