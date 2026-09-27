import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { consultationDTO, acceptConsultation } from "../_shared";
import { relayMessage, relayStatus } from "@/lib/relay";

/**
 * POST /api/consultations/start  body { astrologerId, mode }
 *
 * Phase 2 request → accept lifecycle:
 * - astrologer must exist and be online/away
 * - mode must be in the astrologer's consultationModes
 * - wallet balance must cover ~3 minutes (server-side guard) → 402 otherwise
 * - creates the consultation with status "requested" (startedAt stays null —
 *   billing only begins when the request is ACCEPTED) and a system message
 *   "Request sent to {name}. Waiting for them to accept…"
 * - relays consultation:status "requested" to the room
 * - AUTO-ACCEPT (bot mode): unless this astrologer is operated by a live
 *   console persona (AstrologerAccount.manualMode), a module-level timer
 *   accepts the request after 2.5–4.5s (see acceptTimers below — same pattern
 *   as the reply schedulers in _shared.ts, clearing on re-entry).
 *   In manual mode the console persona accepts/rejects manually.
 * - wallet is NOT debited here; billing settles on end (POST .../end)
 * - returns { consultation: ConsultationDTO }
 */

const startSchema = z.object({
  astrologerId: z.string().min(1),
  mode: z.enum(["chat", "audio", "video"]),
});

const MIN_MINUTES = 3;

interface AutoAcceptTimer {
  timer: ReturnType<typeof setTimeout> | null;
}

/** In-memory auto-accept timers (bot mode only). Lost on dev-server restart —
 *  orphaned requests self-heal via promoteStaleRequest() on user fetch/send. */
const acceptTimers = new Map<string, AutoAcceptTimer>();

function scheduleAutoAccept(consultationId: string): void {
  const existing = acceptTimers.get(consultationId);
  if (existing?.timer) clearTimeout(existing.timer);

  // 2.5–4.5s — feels like a human reading the request
  const delay = 2500 + Math.floor(Math.random() * 2000);
  const state: AutoAcceptTimer = {
    timer: setTimeout(() => {
      acceptTimers.delete(consultationId);
      void autoAcceptIfStillBot(consultationId);
    }, delay),
  };
  acceptTimers.set(consultationId, state);
}

/** Re-checks manualMode at fire time — the console persona may have been
 *  linked between the request and the timer firing. */
async function autoAcceptIfStillBot(consultationId: string): Promise<void> {
  try {
    const consultation = await db.consultation.findUnique({
      where: { id: consultationId },
      select: { status: true, astrologerId: true },
    });
    if (!consultation || consultation.status !== "requested") return;
    const account = await db.astrologerAccount.findUnique({
      where: { astrologerId: consultation.astrologerId },
      select: { manualMode: true },
    });
    if (account?.manualMode === true) return; // console persona took over
    await acceptConsultation(consultationId);
  } catch {
    // DB hiccup — promoteStaleRequest() heals on the next user fetch/send
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, startSchema);
  if (isParseFailure(body)) return body;

  const astrologer = await db.astrologer.findUnique({
    where: { id: body.astrologerId },
  });
  if (!astrologer) {
    return fail(404, "not_found", "This astrologer profile doesn't exist.");
  }
  if (astrologer.onlineStatus === "offline") {
    return fail(409, "astrologer_unavailable", "This astrologer is offline right now. Try someone who is online.");
  }
  const modes = JSON.parse(astrologer.consultationModes) as string[];
  if (!modes.includes(body.mode)) {
    return fail(409, "mode_unsupported", "This consultation mode isn't offered by this astrologer.");
  }

  const wallet = await db.walletAccount.findUnique({ where: { userId: auth.user.id } });
  const balance = wallet?.balance ?? 0;
  const minBalance = astrologer.pricePerMinute * MIN_MINUTES;
  if (balance < minBalance) {
    return fail(
      402,
      "insufficient_balance",
      `Your balance needs at least ${formatINR(minBalance)} (about ${MIN_MINUTES} minutes) to start this consultation.`
    );
  }

  // status "requested" — startedAt null until accepted (billing starts then)
  const consultation = await db.consultation.create({
    data: {
      userId: auth.user.id,
      astrologerId: astrologer.id,
      mode: body.mode,
      ratePerMinute: astrologer.pricePerMinute,
      status: "requested",
    },
    include: { astrologer: true },
  });

  const systemMessage = await db.message.create({
    data: {
      consultationId: consultation.id,
      senderRole: "system",
      content: `Request sent to ${astrologer.displayName}. Waiting for them to accept…`,
      type: "system",
    },
  });

  await db.notification.create({
    data: {
      userId: auth.user.id,
      type: "consultation_update",
      title: "Request sent",
      body: `Your request was sent to ${astrologer.displayName} (${formatINR(astrologer.pricePerMinute)}/min). We'll notify you as soon as it's accepted.`,
      dataJson: JSON.stringify({ consultationId: consultation.id }),
    },
  });

  // relay the initial system message + status so an already-open chat updates
  relayMessage(consultation.id, {
    id: systemMessage.id,
    consultationId: consultation.id,
    senderRole: systemMessage.senderRole,
    content: systemMessage.content,
    type: systemMessage.type,
    readAt: null,
    createdAt: systemMessage.createdAt.toISOString(),
  });
  relayStatus(consultation.id, "requested");

  // bot mode: auto-accept after a short delay; manual mode: the console persona
  // sees the request in its queue and accepts/rejects manually
  const account = await db.astrologerAccount.findUnique({
    where: { astrologerId: astrologer.id },
    select: { manualMode: true },
  });
  if (!account || account.manualMode !== true) {
    scheduleAutoAccept(consultation.id);
  }

  return ok({ consultation: consultationDTO(consultation) });
}
