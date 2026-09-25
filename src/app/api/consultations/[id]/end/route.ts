import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { consultationDTO, generateSummary } from "../../_shared";
import { relayEnded } from "@/lib/relay";

/**
 * POST /api/consultations/[id]/end
 *
 * Billing settles here (the wallet is never touched before this):
 * - duration = endedAt - startedAt; minutes = max(1, ceil(duration/60))
 * - amount = minutes × ratePerMinute, capped at the wallet balance
 *   (never negative — if the balance is lower, only the balance is charged)
 * - wallet debit + WalletTransaction (type "consultation_debit", negative
 *   amount, balanceAfter, description) inside one Prisma transaction
 * - consultation → status "ended", endedAt, durationSeconds, totalAmount
 * - LLM summary (≤8s, template fallback) → consultation.summary
 * - notification with the plain-text billed amount
 * - relays consultation:ended to the socket room
 * → { consultation: ConsultationDTO }
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  const consultation = await db.consultation.findFirst({
    where: { id, userId: auth.user.id },
    include: { astrologer: true },
  });
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }
  if (consultation.status !== "active") {
    return fail(409, "consultation_ended", "This consultation has already ended.");
  }

  const endedAt = new Date();
  const startedAt = consultation.startedAt ?? consultation.createdAt;
  const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  const rawAmount = minutes * consultation.ratePerMinute;

  const settled = await db.$transaction(async (tx) => {
    const wallet = await tx.walletAccount.findUnique({ where: { userId: auth.user.id } });
    const balance = wallet?.balance ?? 0;
    // cap at the wallet balance — never negative
    const amount = Math.min(rawAmount, Math.max(0, balance));

    if (amount > 0 && wallet) {
      const balanceAfter = balance - amount;
      await tx.walletAccount.update({
        where: { userId: auth.user.id },
        data: { balance: balanceAfter },
      });
      await tx.walletTransaction.create({
        data: {
          userId: auth.user.id,
          type: "consultation_debit",
          amount: -amount,
          status: "success",
          description: `Consultation with ${consultation.astrologer.displayName} — ${minutes} min × ${formatINR(consultation.ratePerMinute)}/min`,
          referenceId: consultation.id,
          balanceAfter,
        },
      });
    }

    const updated = await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: "ended",
        endedAt,
        durationSeconds,
        totalAmount: amount,
      },
      include: { astrologer: true },
    });
    return { updated, amount };
  });

  const summary = await generateSummary(settled.updated, minutes);

  const finalConsultation = await db.consultation.update({
    where: { id: consultation.id },
    data: { summary },
    include: { astrologer: true },
  });

  await db.notification.create({
    data: {
      userId: auth.user.id,
      type: "consultation_update",
      title: "Consultation ended",
      body: `Billed ${formatINR(settled.amount)} for ${minutes} min. Summary saved to your history.`,
      dataJson: JSON.stringify({ consultationId: consultation.id }),
    },
  });

  relayEnded(consultation.id);

  return ok({ consultation: consultationDTO(finalConsultation) });
}
