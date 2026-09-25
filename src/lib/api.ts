import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, randomInt } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "tara_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  language: string;
  onboardingDone: boolean;
  createdAt: Date;
}

/** Resolve the current user from the session cookie. Returns null if none. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user as SessionUser;
}

/** API-route guard: returns the user or a 401 response. */
export async function requireUser(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "unauthorized", message: "Please sign in to continue." },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export function isAuthFailure(result: unknown): result is { response: NextResponse } {
  return typeof result === "object" && result !== null && "response" in result;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
}

// ------------------------------------------------------------------ responses

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: code, message }, { status });
}

export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S
): Promise<z.infer<S> | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "bad_json", "The request body could not be read.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, "validation_failed", "Some details were missing or invalid. Please check and retry.");
  }
  return parsed.data;
}

export function isParseFailure(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

// ------------------------------------------------------------------ otp utils

export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}
