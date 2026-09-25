import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

/** Default preferences — everything on, user can turn each off anytime. */
export const DEFAULT_PREFERENCES = {
  daily: true,
  consultations: true,
  payments: true,
  reports: true,
  events: true,
} as const;

export interface NotificationPreferences {
  daily: boolean;
  consultations: boolean;
  payments: boolean;
  reports: boolean;
  events: boolean;
}

function parsePrefs(json: string): NotificationPreferences {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) {
      const p = parsed as Record<string, unknown>;
      return {
        daily: typeof p.daily === "boolean" ? p.daily : true,
        consultations: typeof p.consultations === "boolean" ? p.consultations : true,
        payments: typeof p.payments === "boolean" ? p.payments : true,
        reports: typeof p.reports === "boolean" ? p.reports : true,
        events: typeof p.events === "boolean" ? p.events : true,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_PREFERENCES };
}

/** GET /api/notifications/preferences — current notification settings. */
export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const row = await db.notificationPreference.findUnique({ where: { userId: auth.user.id } });
  return ok({ preferences: row ? parsePrefs(row.prefsJson) : { ...DEFAULT_PREFERENCES } });
}

const prefsSchema = z.object({
  daily: z.boolean(),
  consultations: z.boolean(),
  payments: z.boolean(),
  reports: z.boolean(),
  events: z.boolean(),
});

/** POST /api/notifications/preferences — upsert the user's preference set. */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, prefsSchema);
  if (isParseFailure(body)) return body;

  await db.notificationPreference.upsert({
    where: { userId: auth.user.id },
    update: { prefsJson: JSON.stringify(body) },
    create: { userId: auth.user.id, prefsJson: JSON.stringify(body) },
  });

  return ok({ preferences: body });
}
