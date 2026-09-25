import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";

/** POST /api/notifications/read-all — marks all of the user's notifications read. */
export async function POST() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const result = await db.notification.updateMany({
    where: { userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ ok: true, updated: result.count });
}
