import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { messageDTO, scheduleAstrologerReply } from "../../_shared";
import { relayMessage } from "@/lib/relay";

/**
 * POST /api/consultations/[id]/messages  body { content: string (1..2000) }
 *
 * - own consultation, status must be "active" (409 otherwise)
 * - balance guard: wallet must cover the next minute → 402 "insufficient_balance"
 * - persists the user message and relays it to the socket room
 * - schedules the AI-simulated astrologer reply (typing → LLM → relay);
 *   the schedule runs in the background and is NEVER awaited here
 * - returns { message: MessageDTO } immediately
 */

const messageSchema = z.object({
  content: z.string().trim().min(1, "Message is empty").max(2000, "Message is too long (max 2000 characters)"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, messageSchema);
  if (isParseFailure(body)) return body;

  const { id } = await params;
  const consultation = await db.consultation.findFirst({
    where: { id, userId: auth.user.id },
    include: { astrologer: true },
  });
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }
  if (consultation.status !== "active") {
    return fail(409, "consultation_ended", "This consultation has ended. Start a new one to continue.");
  }

  const wallet = await db.walletAccount.findUnique({ where: { userId: auth.user.id } });
  const balance = wallet?.balance ?? 0;
  if (balance < consultation.ratePerMinute) {
    return fail(
      402,
      "insufficient_balance",
      "Your balance can't cover the next minute. Add money to continue."
    );
  }

  const message = await db.message.create({
    data: {
      consultationId: consultation.id,
      senderRole: "user",
      content: body.content,
      type: "text",
    },
  });

  const dto = messageDTO(message);
  relayMessage(consultation.id, dto);

  // background: typing indicator + AI-simulated astrologer reply
  scheduleAstrologerReply(consultation.id);

  return ok({ message: dto });
}
