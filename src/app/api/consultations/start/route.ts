import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { consultationDTO, systemStartMessage, greetingMessage } from "../_shared";
import { relayMessage } from "@/lib/relay";

/**
 * POST /api/consultations/start  body { astrologerId, mode }
 *
 * - astrologer must exist and be online/away
 * - mode must be in the astrologer's consultationModes
 * - wallet balance must cover ~3 minutes (server-side guard) → 402 otherwise
 * - creates the consultation (status "active"), a system billing message and
 *   the astrologer's greeting (template — no LLM at start)
 * - wallet is NOT debited here; billing settles on end (POST .../end)
 * - returns { consultation: ConsultationDTO }
 */

const startSchema = z.object({
  astrologerId: z.string().min(1),
  mode: z.enum(["chat", "audio", "video"]),
});

const MIN_MINUTES = 3;

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

  const startedAt = new Date();
  const consultation = await db.consultation.create({
    data: {
      userId: auth.user.id,
      astrologerId: astrologer.id,
      mode: body.mode,
      ratePerMinute: astrologer.pricePerMinute,
      status: "active",
      startedAt,
    },
    include: { astrologer: true },
  });

  const [systemMessage, greeting] = await Promise.all([
    db.message.create({
      data: {
        consultationId: consultation.id,
        senderRole: "system",
        content: systemStartMessage(astrologer.pricePerMinute),
        type: "system",
      },
    }),
    db.message.create({
      data: {
        consultationId: consultation.id,
        senderRole: "astrologer",
        content: greetingMessage(astrologer),
        type: "text",
      },
    }),
  ]);

  await db.notification.create({
    data: {
      userId: auth.user.id,
      type: "consultation_update",
      title: "Consultation started",
      body: `Consultation with ${astrologer.displayName} started at ${formatINR(astrologer.pricePerMinute)}/min. You can end anytime.`,
      dataJson: JSON.stringify({ consultationId: consultation.id }),
    },
  });

  // relay the two initial messages so an already-open chat picks them up
  relayMessage(consultation.id, {
    id: systemMessage.id,
    consultationId: consultation.id,
    senderRole: systemMessage.senderRole,
    content: systemMessage.content,
    type: systemMessage.type,
    readAt: null,
    createdAt: systemMessage.createdAt.toISOString(),
  });
  relayMessage(consultation.id, {
    id: greeting.id,
    consultationId: consultation.id,
    senderRole: greeting.senderRole,
    content: greeting.content,
    type: greeting.type,
    readAt: null,
    createdAt: greeting.createdAt.toISOString(),
  });

  return ok({ consultation: consultationDTO(consultation) });
}
