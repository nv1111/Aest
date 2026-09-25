import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";

/**
 * GET /api/ask/conversations — the user's conversation list, newest first.
 */
export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const rows = await db.aiConversation.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { _count: { select: { messages: true } } },
  });

  return ok({
    conversations: rows.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    })),
  });
}
