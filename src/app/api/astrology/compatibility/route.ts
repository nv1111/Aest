import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";
import { provider, toAstrologyInput } from "@/lib/astrology/server";
import { cached } from "@/lib/cache";

const schema = z.object({
  profileAId: z.string().uuid().optional(),
  profileBId: z.string().uuid().optional(),
  /** inline creation of profile B (compatibility flow) */
  profileB: z
    .object({
      name: z.string().trim().min(1).max(60),
      relation: z.enum(["partner", "family", "other"]).optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      timeOfBirth: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
      timeAccuracy: z.enum(["exact", "approximate", "unknown"]),
      placeName: z.string().trim().min(1).max(120),
      placeCountry: z.string().trim().max(60).nullable().optional(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      timezone: z.string().trim().min(3).max(60),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, schema);
  if (isParseFailure(body)) return body;

  const user = auth.user;
  const profileA = body.profileAId
    ? await db.birthProfile.findFirst({ where: { id: body.profileAId, userId: user.id } })
    : await db.birthProfile.findFirst({
        where: { userId: user.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
  if (!profileA) return fail(404, "no_profile", "Add your birth details first.");

  let profileB = body.profileBId
    ? await db.birthProfile.findFirst({ where: { id: body.profileBId, userId: user.id } })
    : null;

  if (!profileB && body.profileB) {
    const count = await db.birthProfile.count({ where: { userId: user.id } });
    if (count >= 6) {
      return fail(422, "too_many_profiles", "You can save up to 6 birth profiles.");
    }
    profileB = await db.birthProfile.create({
      data: {
        userId: user.id,
        name: body.profileB.name,
        relation: body.profileB.relation ?? "partner",
        dateOfBirth: body.profileB.dateOfBirth,
        timeOfBirth: body.profileB.timeAccuracy === "unknown" ? null : body.profileB.timeOfBirth ?? null,
        timeAccuracy: body.profileB.timeAccuracy,
        placeName: body.profileB.placeName,
        placeCountry: body.profileB.placeCountry ?? null,
        latitude: body.profileB.latitude,
        longitude: body.profileB.longitude,
        timezone: body.profileB.timezone,
      },
    });
  }
  if (!profileB) return fail(422, "profile_b_required", "Choose or add the second person's birth details.");

  const result = await cached(
    `compat:${profileA.id}:${profileA.updatedAt.toISOString()}:${profileB.id}:${profileB.updatedAt.toISOString()}`,
    24 * 3600000,
    () =>
      provider().getCompatibility(
        { id: profileA.id, input: toAstrologyInput(profileA) },
        { id: profileB.id, input: toAstrologyInput(profileB) }
      )
  );
  return ok(result);
}
