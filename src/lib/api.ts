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
  role: string;
  demoPersona: string | null;
  createdAt: Date;
}

/** Persona currently driving the UI: null = customer app. */
export type DemoPersona = "astrologer" | "admin";

export function isDemoPersona(v: string | null | undefined): v is DemoPersona {
  return v === "astrologer" || v === "admin";
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

/**
 * Phase 2 role-switch demo: guard a console API route.
 * `persona` must be the ACTIVE demo persona (user.demoPersona) — or, in
 * production (Phase 6), the user's real `role`. Dev protocol: the customer
 * persona can never reach console APIs.
 */
export async function requirePersona(
  persona: DemoPersona
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const result = await requireUser();
  if (isAuthFailure(result)) return result;
  const { user } = result;
  const active = isDemoPersona(user.demoPersona) ? user.demoPersona : null;
  const allowed = active === persona || user.role === persona;
  if (!allowed) {
    return {
      response: NextResponse.json(
        {
          error: "forbidden",
          message: `This area is for the ${persona} console. Switch persona first.`,
        },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/**
 * Resolve the AstrologerAccount row for the astrologer-console caller.
 * Returns null when the user has no linked astrologer profile yet.
 */
export async function getAstrologerAccount(userId: string) {
  const { db: prisma } = await import("@/lib/db");
  return prisma.astrologerAccount.findUnique({
    where: { userId },
    include: { astrologer: true },
  });
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

/**
 * The app is embedded as a THIRD-PARTY iframe inside the Z.ai preview panel
 * (top-level page is on z.ai; the app origin is *.space-z.ai). In that
 * context browsers refuse to set or send SameSite=Lax cookies — OTP login
 * "succeeds" server-side, but every subsequent authed call 401s (observed:
 * verify-otp 200 → me 401 → POST /api/profiles 401 ×4). SameSite=None +
 * Secure is the standard setting for iframe-embedded apps; browsers treat
 * http://localhost as a secure context, so dev QA keeps working.
 * (CSRF surface widens with None — server-side Origin checks land in Phase 6.)
 */
const SESSION_COOKIE_ATTRS = {
  httpOnly: true as const,
  sameSite: "none" as const,
  secure: true,
  path: "/",
};

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_ATTRS,
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  // Expire with the SAME attributes — a default (Lax) deletion Set-Cookie
  // would itself be blocked in the third-party iframe context.
  store.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_ATTRS, maxAge: 0 });
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
