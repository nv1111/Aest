import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";

export async function POST() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;
  await db.user.update({ where: { id: auth.user.id }, data: { onboardingDone: true } });
  return ok({ ok: true });
}
