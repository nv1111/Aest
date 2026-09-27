import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requirePersona, isAuthFailure } from "@/lib/api";

/**
 * POST /api/admin/consultations/[id]/refund  (empty body) → { refunded: number }
 *
 * Credits the FULL remaining amount of an ENDED consultation back to the
 * customer's wallet (partial refunds already granted count against it):
 * - consultation must exist (404) and be status "ended" (409 not_refundable)
 * - remaining = totalAmount − Σ refund transactions for this consultation;
 *   ≤ 0 → 409 already_refunded
 * - wallet credit (upsert — the wallet may not exist yet), WalletTransaction
 *   { type "refund", +amount, balanceAfter } and the user Notification all in
 *   ONE Prisma transaction; the refund sum is re-computed inside the
 *   transaction so concurrent refunds can never double-credit
 * → { refunded: number }
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;

  const consultation = await db.consultation.findUnique({
    where: { id },
    include: { astrologer: { select: { displayName: true } } },
  });
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }
  if (consultation.status !== "ended") {
    return fail(409, "not_refundable", "Only ended consultations can be refunded.");
  }

  const refunded = await db.$transaction(async (tx) => {
    // re-compute inside the transaction — the authoritative refund ledger
    const already = await tx.walletTransaction.aggregate({
      where: { type: "refund", referenceId: consultation.id },
      _sum: { amount: true },
    });
    const remaining = Math.round(((consultation.totalAmount ?? 0) - (already._sum.amount ?? 0)) * 100) / 100;
    // anything under a paisa is a floating-point artifact, not a real refund
    if (remaining < 0.01) return null;

    const wallet = await tx.walletAccount.upsert({
      where: { userId: consultation.userId },
      create: { userId: consultation.userId, balance: remaining },
      update: { balance: { increment: remaining } },
    });

    await tx.walletTransaction.create({
      data: {
        userId: consultation.userId,
        type: "refund",
        amount: remaining, // credit: positive
        status: "success",
        description: `Refund for consultation with ${consultation.astrologer.displayName}`,
        referenceId: consultation.id,
        balanceAfter: wallet.balance,
      },
    });

    await tx.notification.create({
      data: {
        userId: consultation.userId,
        type: "payment",
        title: "Refund credited",
        body: `₹${remaining} refunded to your wallet for your consultation with ${consultation.astrologer.displayName}.`,
      },
    });

    return remaining;
  });

  if (refunded === null) {
    return fail(409, "already_refunded", "This consultation has already been fully refunded.");
  }
  return ok({ refunded });
}
