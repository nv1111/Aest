import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, createSession, setSessionCookie } from "@/lib/api";

const schema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  code: z.string().trim().regex(/^\d{6}$/),
  name: z.string().trim().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  const body = await parseBody(req, schema);
  if (isParseFailure(body)) return body;
  const { phone, code, name } = body;

  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt < new Date()) {
    return fail(400, "otp_expired", "This code has expired. Please request a new one.");
  }
  if (otp.attempts >= 5) {
    return fail(429, "otp_locked", "Too many wrong attempts. Please request a new code.");
  }
  if (otp.code !== code) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return fail(400, "otp_wrong", "That code doesn't match. Please check and retry.");
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  let user = await db.user.findUnique({ where: { phone } });
  const isNewUser = !user;
  if (!user) {
    user = await db.user.create({
      data: { phone, name: name ?? null },
    });
    await db.walletAccount.create({ data: { userId: user.id, balance: 0 } });
    // welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        type: "payment",
        title: "Welcome to Tara",
        body: "Your account is ready. Add your birth details to get your first reading.",
      },
    });
  } else if (name && !user.name) {
    user = await db.user.update({ where: { id: user.id }, data: { name } });
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

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
    isNewUser,
  });
}
