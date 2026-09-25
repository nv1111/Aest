import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

/**
 * POST /api/ask/feedback — thumbs up/down on an assistant answer.
 * Only allowed on messages inside the user's own conversations.
 */
const bodySchema = z.object({
  messageId: z.string().uuid(),
  feedback: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  const message = await db.aiMessage.findFirst({
    where: { id: body.messageId, conversation: { userId: auth.user.id } },
  });
  if (!message) {
    return fail(404, "not_found", "This message is no longer available.");
  }

  const updated = await db.aiMessage.update({
    where: { id: message.id },
    data: { feedback: body.feedback },
  });

  return ok({ messageId: updated.id, feedback: updated.feedback });
}
