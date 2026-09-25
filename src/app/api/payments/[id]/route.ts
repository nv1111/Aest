import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { getPaymentProvider } from "@/lib/payments";
import type { Payment } from "@prisma/client";

/**
 * GET /api/payments/[id] — payment status polling AND settlement.
 *
 * The client polls this endpoint; the SERVER decides the outcome. The client
 * never reports success (AGENTS.md §2.9 money rule).
 *
 * Age-based state machine (deterministic, demo):
 *   age < 1.2s          → "created"
 *   1.2s ≤ age < 3s     → "created" moves to "processing"
 *   3s ≤ age < 6s       → "processing"
 *   age ≥ 6s            → SETTLE (transaction-safe):
 *        decline ≈ 1 in 8 — the first hex char of the payment id in {0,1}
 *        → "failed" with failureReason "Your bank declined the payment (demo)".
 *        Otherwise → "success": credit the wallet atomically (balance +
 *        WalletTransaction + Payment update + Notification, all in one tx).
 */

const TERMINAL = new Set(["success", "failed", "refunded"]);

const FAILURE_REASON = "Your bank declined the payment (demo)";

function methodLabel(method: string): string {
  if (method === "upi") return "UPI";
  if (method === "card") return "card";
  return "netbanking";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;
  const { id } = await ctx.params;

  let payment = await db.payment.findFirst({ where: { id, userId: auth.user.id } });
  if (!payment) return fail(404, "not_found", "Payment not found.");

  if (!TERMINAL.has(payment.status)) {
    const ageMs = Date.now() - payment.createdAt.getTime();
    if (ageMs >= 6000) {
      payment = (await settle(payment.id)) ?? payment;
    } else if (ageMs >= 3000 || (ageMs >= 1200 && payment.status === "created")) {
      if (payment.status === "created") {
        payment = await db.payment.update({ where: { id: payment.id }, data: { status: "processing" } });
      }
    }
  }

  const wallet =
    payment.status === "success"
      ? await db.walletAccount.findUnique({ where: { userId: auth.user.id } })
      : null;

  return ok({
    payment: {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
      failureReason: payment.failureReason,
    },
    ...(wallet ? { balance: wallet.balance } : {}),
  });
}

/**
 * Settles a payment inside a single Prisma transaction so a wallet credit can
 * never be applied twice or without its ledger row. Concurrent polls are safe:
 * the transaction re-reads the row and no-ops when already terminal.
 */
async function settle(paymentId: string): Promise<Payment | null> {
  const provider = getPaymentProvider();

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || TERMINAL.has(payment.status)) return payment;

    // Deterministic demo verdict — the PROVIDER reference, not our row id.
    // (The mock gateway's decline logic keys off its own hex ref; passing the
    // Prisma UUID here would silently read a different "first hex char".)
    const gateway = await provider.getStatus(payment.gatewayRef ?? payment.id);

    if (gateway.status === "failed") {
      return tx.payment.update({
        where: { id: payment.id },
        data: { status: "failed", failureReason: FAILURE_REASON, completedAt: new Date() },
      });
    }

    // Success — credit the wallet atomically.
    const wallet = await tx.walletAccount.upsert({
      where: { userId: payment.userId },
      create: { userId: payment.userId, balance: payment.amount },
      update: { balance: { increment: payment.amount } },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        userId: payment.userId,
        type: "recharge",
        amount: payment.amount, // credit: positive
        status: "success",
        description: `Wallet recharge via ${methodLabel(payment.method)} (demo)`,
        referenceId: payment.id,
        balanceAfter: wallet.balance,
      },
    });

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "success", transactionId: transaction.id, completedAt: new Date() },
    });

    await tx.notification.create({
      data: {
        userId: payment.userId,
        type: "payment",
        title: "Money added",
        body: `₹${payment.amount} was added to your wallet.`,
      },
    });

    return updated;
  });
}
