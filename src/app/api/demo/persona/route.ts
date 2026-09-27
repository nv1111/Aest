import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

/**
 * POST /api/demo/persona — Phase 2 role-switch demo switcher.
 *
 * body { persona: "user" | "astrologer" | "admin", astrologerId? }
 *
 * - persona "user": back to the customer app; any linked AstrologerAccount
 *   drops manualMode (the AI auto-reply bot resumes).
 * - persona "astrologer": requires astrologerId (a demo astrologer to operate
 *   as). Links (or re-links) the caller's AstrologerAccount, sets
 *   manualMode=true (bot OFF — console replies are manual) and flips the
 *   astrologer online so the marketplace reflects "online".
 * - persona "admin": demo Super Admin view.
 *
 * Re-linking reassigns the account row (astrologerId is unique — one console
 * persona drives an astrologer at a time; the previous holder is unlinked).
 * Persisted on the User row — survives reloads and new sessions.
 */

const personaSchema = z.object({
  persona: z.enum(["user", "astrologer", "admin"]),
  astrologerId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, personaSchema);
  if (isParseFailure(body)) return body;

  // leaving the consoles → bot mode resumes
  if (body.persona !== "astrologer") {
    await db.astrologerAccount.updateMany({
      where: { userId: auth.user.id },
      data: { manualMode: false },
    });
    await db.user.update({
      where: { id: auth.user.id },
      data: { demoPersona: body.persona === "admin" ? "admin" : null },
    });
    return ok({ demoPersona: body.persona === "admin" ? "admin" : null });
  }

  if (!body.astrologerId) {
    return fail(422, "astrologer_required", "Pick a demo astrologer to operate as.");
  }
  const astrologer = await db.astrologer.findUnique({ where: { id: body.astrologerId } });
  if (!astrologer) {
    return fail(404, "not_found", "This astrologer profile doesn't exist.");
  }
  if (astrologer.kycStatus === "suspended" || astrologer.kycStatus === "rejected") {
    return fail(409, "astrologer_suspended", "This astrologer is not available to operate.");
  }

  // one console persona per astrologer — reassign cleanly
  await db.astrologerAccount.deleteMany({ where: { astrologerId: astrologer.id } });
  await db.astrologerAccount.upsert({
    where: { userId: auth.user.id },
    create: {
      userId: auth.user.id,
      astrologerId: astrologer.id,
      manualMode: true,
    },
    update: {
      astrologerId: astrologer.id,
      manualMode: true,
      status: "active",
    },
  });

  await db.user.update({
    where: { id: auth.user.id },
    data: { demoPersona: "astrologer" },
  });

  // the operated astrologer is live in the console → marketplace shows online
  if (astrologer.onlineStatus === "offline") {
    await db.astrologer.update({
      where: { id: astrologer.id },
      data: { onlineStatus: "online" },
    });
  }

  return ok({
    demoPersona: "astrologer",
    astrologer: { id: astrologer.id, displayName: astrologer.displayName },
  });
}
