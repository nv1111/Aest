import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { toDto } from "../_lib/dto";

/**
 * GET /api/ask/messages?conversationId= — messages of one of the user's
 * own conversations, oldest first (max 100).
 */
const querySchema = z.object({ conversationId: z.string().uuid() });

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const parsed = querySchema.safeParse({
    conversationId: req.nextUrl.searchParams.get("conversationId") ?? undefined,
  });
  if (!parsed.success) {
    return fail(422, "validation_failed", "A valid conversation id is required.");
  }

  const conversation = await db.aiConversation.findFirst({
    where: { id: parsed.data.conversationId, userId: auth.user.id },
  });
  if (!conversation) {
    return fail(404, "not_found", "This conversation is no longer available.");
  }

  const rows = await db.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return ok({ messages: rows.map(toDto) });
}
