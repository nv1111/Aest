import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import {
  requireConsoleAstrologer,
  isGuardFailure,
  consoleConsultationDTO,
  consoleConsultationInclude,
} from "../_shared";
import type { AstrologerDashboardDTO } from "@/types/console";

/**
 * GET /api/astrologer-console/dashboard → AstrologerDashboardDTO
 *
 * Everything the console home screen needs in one call:
 * - astrologer: the operated profile (expertise/languages are JSON columns)
 * - earnings: from SETTLED (status "ended") consultations only.
 *   Commission split: the company keeps 20%, the astrologer earns 80% of
 *   every settled amount (Phase 3 replaces this demo proxy with an
 *   EarningsLedger + payout pipeline).
 *     total          = 0.8 × gross lifetime settled
 *     today          = 0.8 × settled today (endedAt within the server's today)
 *     pendingPayout  = 0.8 × settled within the last 7 days (demo proxy for
 *                      "earned but not yet paid out")
 *     lifetimeConsultations = count of ended consultations
 * - stats: counts across ALL statuses (total, active, requested queue,
 *   cancelled)
 * - queue: requested, newest first; active: oldest first (longest waiting);
 *   recentEnded: last 8, newest first — all ConsoleConsultationDTO
 * - reviews: last 6, newest first
 */

const COMPANY_COMMISSION = 0.2; // company keeps 20% — astrologer share is 80%
const ASTROLOGER_SHARE = 1 - COMPANY_COMMISSION;

export async function GET() {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const astrologer = guard.account.astrologer;
  const astrologerId = astrologer.id;

  // ---- earnings (settled = status "ended" for THIS astrologer) ----
  const settled = await db.consultation.findMany({
    where: { astrologerId, status: "ended" },
    select: { totalAmount: true, endedAt: true },
  });
  const gross = settled.reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const grossToday = settled
    .filter((c) => c.endedAt && c.endedAt >= startOfToday)
    .reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const grossPending = settled
    .filter((c) => c.endedAt && c.endedAt >= sevenDaysAgo)
    .reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);

  // ---- stats across all statuses ----
  const [totalConsultations, activeNow, queueCount, cancelledCount] = await Promise.all([
    db.consultation.count({ where: { astrologerId } }),
    db.consultation.count({ where: { astrologerId, status: "active" } }),
    db.consultation.count({ where: { astrologerId, status: "requested" } }),
    db.consultation.count({ where: { astrologerId, status: "cancelled" } }),
  ]);

  // ---- lists + reviews ----
  const [queue, active, recentEnded, reviews] = await Promise.all([
    db.consultation.findMany({
      where: { astrologerId, status: "requested" },
      include: consoleConsultationInclude,
      orderBy: { createdAt: "desc" },
    }),
    db.consultation.findMany({
      where: { astrologerId, status: "active" },
      include: consoleConsultationInclude,
      orderBy: { startedAt: "asc" }, // longest waiting first
    }),
    db.consultation.findMany({
      where: { astrologerId, status: "ended" },
      include: consoleConsultationInclude,
      orderBy: { endedAt: "desc" },
      take: 8,
    }),
    db.review.findMany({
      where: { astrologerId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const dto: AstrologerDashboardDTO = {
    astrologer: {
      id: astrologer.id,
      displayName: astrologer.displayName,
      slug: astrologer.slug,
      photoUrl: astrologer.photoUrl,
      onlineStatus: astrologer.onlineStatus,
      rating: astrologer.rating,
      reviewCount: astrologer.reviewCount,
      pricePerMinute: astrologer.pricePerMinute,
      experienceYears: astrologer.experienceYears,
      expertise: JSON.parse(astrologer.expertise) as string[],
      languages: JSON.parse(astrologer.languages) as string[],
    },
    earnings: {
      total: gross * ASTROLOGER_SHARE,
      today: grossToday * ASTROLOGER_SHARE,
      pendingPayout: grossPending * ASTROLOGER_SHARE,
      lifetimeConsultations: settled.length,
    },
    stats: {
      totalConsultations,
      activeNow,
      queueCount,
      cancelledCount,
    },
    queue: queue.map(consoleConsultationDTO),
    active: active.map(consoleConsultationDTO),
    recentEnded: recentEnded.map(consoleConsultationDTO),
    reviews: reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return ok(dto);
}
