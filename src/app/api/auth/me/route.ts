import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return fail(401, "unauthorized", "Not signed in");
  }

  const [profiles, wallet, unreadCount, astrologerAccount] = await Promise.all([
    db.birthProfile.findMany({
      where: { userId: user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    db.walletAccount.findUnique({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.astrologerAccount.findUnique({
      where: { userId: user.id },
      include: {
        astrologer: {
          select: {
            id: true,
            displayName: true,
            slug: true,
            photoUrl: true,
            onlineStatus: true,
            pricePerMinute: true,
            rating: true,
          },
        },
      },
    }),
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
      role: user.role,
      demoPersona: user.demoPersona,
      createdAt: user.createdAt,
    },
    profiles,
    primaryProfile: profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null,
    wallet: { balance: wallet?.balance ?? 0, currency: "INR" },
    unreadCount,
    astrologerAccount: astrologerAccount
      ? {
          astrologerId: astrologerAccount.astrologer.id,
          displayName: astrologerAccount.astrologer.displayName,
          slug: astrologerAccount.astrologer.slug,
          photoUrl: astrologerAccount.astrologer.photoUrl,
          onlineStatus: astrologerAccount.astrologer.onlineStatus,
          pricePerMinute: astrologerAccount.astrologer.pricePerMinute,
          rating: astrologerAccount.astrologer.rating,
          manualMode: astrologerAccount.manualMode,
        }
      : null,
  });
}
