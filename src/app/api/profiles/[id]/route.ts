import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  relation: z.enum(["self", "partner", "family", "other"]).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeOfBirth: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  timeAccuracy: z.enum(["exact", "approximate", "unknown"]).optional(),
  placeName: z.string().trim().min(1).max(120).optional(),
  placeCountry: z.string().trim().max(60).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().trim().min(3).max(60).optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;
  const { id } = await ctx.params;

  const existing = await db.birthProfile.findFirst({ where: { id, userId: auth.user.id } });
  if (!existing) return fail(404, "not_found", "Birth profile not found.");

  const body = await parseBody(req, patchSchema);
  if (isParseFailure(body)) return body;

  if (body.isPrimary) {
    await db.birthProfile.updateMany({
      where: { userId: auth.user.id, NOT: { id } },
      data: { isPrimary: false },
    });
  }

  const patch = { ...body };
  if (patch.timeAccuracy === "unknown") patch.timeOfBirth = null;

  const profile = await db.birthProfile.update({ where: { id }, data: patch });
  return ok(profile);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;
  const { id } = await ctx.params;

  const existing = await db.birthProfile.findFirst({ where: { id, userId: auth.user.id } });
  if (!existing) return fail(404, "not_found", "Birth profile not found.");

  await db.birthProfile.delete({ where: { id } });

  // promote another profile to primary if we removed the primary
  if (existing.isPrimary) {
    const next = await db.birthProfile.findFirst({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await db.birthProfile.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  return ok({ ok: true });
}
