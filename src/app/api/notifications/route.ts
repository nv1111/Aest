import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";

/** GET /api/notifications?limit=50 — the user's notification history, newest first. */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const raw = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 100) : 50;

  const notifications = await db.notification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ok({ notifications });
}
