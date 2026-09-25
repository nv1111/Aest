import { ok, clearSessionCookie } from "@/lib/api";

export async function POST() {
  await clearSessionCookie();
  return ok({ ok: true });
}
