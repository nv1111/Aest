import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { getPaymentProvider } from "@/lib/payments";

const bodySchema = z.object({
  amount: z
    .number()
    .int()
    .min(50, "Minimum recharge is ₹50")
    .max(25000, "Maximum recharge is ₹25,000"),
  method: z.enum(["upi", "card", "netbanking"]),
});

/**
 * POST /api/wallet/recharge — starts a payment attempt via the provider and
 * stores it as a Payment row with status "created". Settlement happens ONLY
 * server-side in GET /api/payments/[id] (the client never reports success).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  const provider = getPaymentProvider();
  const creation = await provider.createPayment(auth.user.id, body.amount, body.method);

  const payment = await db.payment.create({
    data: {
      userId: auth.user.id,
      amount: body.amount,
      method: body.method,
      status: "created",
      gatewayRef: creation.paymentId,
    },
  });

  return ok({
    payment: {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      method: payment.method,
    },
  });
}
