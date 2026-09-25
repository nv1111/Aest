import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";

/**
 * POST /api/ask/conversations/clear — delete all of the user's AI
 * conversations (fresh start). Messages cascade.
 */
export async function POST() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const deleted = await db.aiConversation.deleteMany({ where: { userId: auth.user.id } });
  return ok({ deleted: deleted.count });
}
