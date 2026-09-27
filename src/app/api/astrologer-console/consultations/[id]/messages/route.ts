import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure } from "@/lib/api";
import { messageDTO } from "@/app/api/consultations/_shared";
import { relayMessage, relayEmit, consultationRoom } from "@/lib/relay";
import {
  requireConsoleAstrologer,
  isGuardFailure,
  consoleConsultationDTO,
  consoleConsultationInclude,
} from "../../../_shared";

/**
 * /api/astrologer-console/consultations/[id]/messages
 *
 * GET  → { consultation: ConsoleConsultationDTO, messages: MessageDTO[] }
 *       Own (operated) consultation, ANY status (requested transcripts are
 *       viewable before accepting). Messages oldest-first.
 *
 * POST body { content: string 1..2000 } → { message: MessageDTO }
 *       - ownership + status must be "active" (409 otherwise)
 *       - persists the message senderRole "astrologer", type "text"
 *       - marks the user's unread messages read (readAt = now)
 *       - relays "consultation:read" with the CONSOLE USER's OWN userId (not
 *         the literal "astrologer") so the customer's socket hook — which
 *         filters only its own userId — renders the double ticks
 *       - relays the message to the room
 */

const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message is empty")
    .max(2000, "Message is too long (max 2000 characters)"),
});

async function loadOwnedConsultation(id: string, astrologerId: string) {
  return db.consultation.findUnique({
    where: { id },
    select: { id: true, astrologerId: true, status: true },
  }).then((c) => (c && c.astrologerId === astrologerId ? c : null));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const { id } = await params;
  const consultation = await loadOwnedConsultation(id, guard.account.astrologerId);
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  const [row, messages] = await Promise.all([
    db.consultation.findUnique({
      where: { id },
      include: consoleConsultationInclude,
    }),
    db.message.findMany({
      where: { consultationId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!row) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  return ok({
    consultation: consoleConsultationDTO(row),
    messages: messages.map(messageDTO),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const body = await parseBody(req, messageSchema);
  if (isParseFailure(body)) return body;

  const { id } = await params;
  const consultation = await loadOwnedConsultation(id, guard.account.astrologerId);
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }
  if (consultation.status !== "active") {
    return fail(
      409,
      "consultation_not_active",
      "Only an accepted (active) consultation can be replied to."
    );
  }

  const message = await db.message.create({
    data: {
      consultationId: id,
      senderRole: "astrologer",
      content: body.content,
      type: "text",
    },
  });

  // the console astrologer has now read everything the user sent
  const readAt = new Date();
  await db.message.updateMany({
    where: { consultationId: id, senderRole: "user", readAt: null },
    data: { readAt },
  });

  // emit with the console user's OWN userId — the customer hook ignores only
  // its own userId, so this is what makes the ticks light up client-side
  relayEmit(consultationRoom(id), "consultation:read", {
    userId: guard.user.id,
    readAt: readAt.toISOString(),
  });

  const dto = messageDTO(message);
  relayMessage(id, dto);

  return ok({ message: dto });
}
