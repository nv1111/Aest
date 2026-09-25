import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, generateOtp } from "@/lib/api";

const schema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

const OTP_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await parseBody(req, schema);
  if (isParseFailure(body)) return body;

  const { phone } = body;

  // basic abuse guard: max 5 codes per phone per hour
  const since = new Date(Date.now() - 3600_000);
  const recent = await db.otpCode.count({ where: { phone, createdAt: { gt: since } } });
  if (recent >= 5) {
    return fail(429, "too_many_requests", "Too many codes requested. Please wait a few minutes and retry.");
  }

  const code = generateOtp();
  await db.otpCode.create({
    data: { phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  // DEMO MODE: no SMS provider is connected, so the code is returned and the
  // UI must label it (AGENTS.md §8). Never do this with a real SMS gateway.
  return ok({ phone, demoOtp: code, expiresInSeconds: Math.round(OTP_TTL_MS / 1000) });
}
