import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requirePersona, isAuthFailure } from "@/lib/api";
import { consoleConsultationDTO } from "../_dto";

/**
 * GET /api/admin/dashboard → AdminDashboardDTO (Phase 2 Super Admin console).
 *
 * All metrics + the two recent lists batch into ONE Promise.all — the Supabase
 * pooler adds ~250-450 ms per sequential round trip, so parallel queries keep
 * the console load under a single round trip.
 *
 * Definitions (fixed contract, see src/types/console.ts):
 * - activeConsultations: status "active" ONLY (requested is not active)
 * - grossRevenue:        Σ Consultation.totalAmount where status "ended"
 * - walletLiability:     Σ WalletAccount.balance (money owed to customers)
 * - openTickets:         SupportTicket status != "resolved"
 */
export async function GET(_req: NextRequest) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [
    totalUsers,
    newUsers7d,
    totalConsultations,
    activeConsultations,
    grossRevenue,
    walletLiability,
    astrologersTotal,
    astrologersOnline,
    pendingKyc,
    openTickets,
    reportsGenerated,
    recentUsers,
    recentConsultations,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.consultation.count(),
    db.consultation.count({ where: { status: "active" } }),
    db.consultation.aggregate({ where: { status: "ended" }, _sum: { totalAmount: true } }),
    db.walletAccount.aggregate({ _sum: { balance: true } }),
    db.astrologer.count(),
    db.astrologer.count({ where: { onlineStatus: "online" } }),
    db.astrologer.count({ where: { kycStatus: "pending" } }),
    db.supportTicket.count({ where: { status: { not: "resolved" } } }),
    db.report.count(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, phone: true, createdAt: true },
    }),
    db.consultation.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return ok({
    metrics: {
      totalUsers,
      newUsers7d,
      totalConsultations,
      activeConsultations,
      grossRevenue: grossRevenue._sum.totalAmount ?? 0,
      walletLiability: walletLiability._sum.balance ?? 0,
      astrologersTotal,
      astrologersOnline,
      pendingKyc,
      openTickets,
      reportsGenerated,
    },
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      createdAt: u.createdAt.toISOString(),
    })),
    recentConsultations: recentConsultations.map((c) =>
      consoleConsultationDTO(c, c._count.messages)
    ),
  });
}
