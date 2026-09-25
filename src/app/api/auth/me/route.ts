import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return fail(401, "unauthorized", "Not signed in");
  }

  const [profiles, wallet, unreadCount] = await Promise.all([
    db.birthProfile.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    db.walletAccount.findUnique({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return ok({
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      language: user.language,
      onboardingDone: user.onboardingDone,
      createdAt: user.createdAt,
    },
    profiles,
    primaryProfile: profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null,
    wallet: { balance: wallet?.balance ?? 0, currency: "INR" },
    unreadCount,
  });
}
