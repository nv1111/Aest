import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";
import { clearSessionCookie } from "@/lib/api";

/** Permanent, cascading deletion (see prisma relations). */
export async function POST() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  await db.user.delete({ where: { id: auth.user.id } });
  await clearSessionCookie();
  return ok({ ok: true });
}
