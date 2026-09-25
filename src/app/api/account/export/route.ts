import { db } from "@/lib/db";
import { ok, requireUser, isAuthFailure } from "@/lib/api";

/**
 * GET /api/account/export — everything we store about the user, in one JSON
 * document the user controls. The client downloads it as a file.
 */
export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const [profiles, consultations, wallet, transactions, reports, notifications, supportTickets] =
    await Promise.all([
      db.birthProfile.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "asc" },
      }),
      db.consultation.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { messages: true } } },
      }),
      db.walletAccount.findUnique({ where: { userId: auth.user.id } }),
      db.walletTransaction.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.report.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      db.notification.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.supportTicket.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, subject: true, category: true, status: true, createdAt: true },
      }),
    ]);

  return ok({
    format: "tara-account-export/1",
    exportedAt: new Date().toISOString(),
    user: {
      id: auth.user.id,
      phone: auth.user.phone,
      email: auth.user.email,
      name: auth.user.name,
      language: auth.user.language,
      createdAt: auth.user.createdAt,
    },
    birthProfiles: profiles.map((p) => ({
      name: p.name,
      relation: p.relation,
      dateOfBirth: p.dateOfBirth,
      timeOfBirth: p.timeOfBirth,
      timeAccuracy: p.timeAccuracy,
      placeName: p.placeName,
      placeCountry: p.placeCountry,
      latitude: p.latitude,
      longitude: p.longitude,
      timezone: p.timezone,
      isPrimary: p.isPrimary,
      createdAt: p.createdAt,
    })),
    consultations: consultations.map((c) => ({
      id: c.id,
      astrologerId: c.astrologerId,
      mode: c.mode,
      status: c.status,
      ratePerMinute: c.ratePerMinute,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      durationSeconds: c.durationSeconds,
      totalAmount: c.totalAmount,
      messageCount: c._count.messages,
      createdAt: c.createdAt,
    })),
    wallet: {
      balance: wallet?.balance ?? 0,
      currency: wallet?.currency ?? "INR",
      transactions,
    },
    reports,
    notifications,
    supportTickets,
  });
}
