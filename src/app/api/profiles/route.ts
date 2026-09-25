import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

const timeStr = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  }, "Date must be in the past");

const createSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    relation: z.enum(["self", "partner", "family", "other"]).optional(),
    dateOfBirth: dateStr,
    timeOfBirth: timeStr.nullable().optional(),
    timeAccuracy: z.enum(["exact", "approximate", "unknown"]),
    placeName: z.string().trim().min(1).max(120),
    placeCountry: z.string().trim().max(60).nullable().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().trim().min(3).max(60),
  })
  .refine(
    (d) =>
      d.timeAccuracy === "unknown"
        ? true
        : d.timeAccuracy === "approximate"
          ? d.timeOfBirth !== null && d.timeOfBirth !== undefined
          : typeof d.timeOfBirth === "string",
    { message: "Time of birth is required for exact/approximate accuracy" }
  );

export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;
  const profiles = await db.birthProfile.findMany({
    where: { userId: auth.user.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return ok(profiles);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, createSchema);
  if (isParseFailure(body)) return body;

  const existingCount = await db.birthProfile.count({ where: { userId: auth.user.id } });
  if (existingCount >= 6) {
    return fail(422, "too_many_profiles", "You can save up to 6 birth profiles.");
  }

  const profile = await db.birthProfile.create({
    data: {
      userId: auth.user.id,
      name: body.name,
      relation: body.relation ?? "self",
      dateOfBirth: body.dateOfBirth,
      timeOfBirth: body.timeAccuracy === "unknown" ? null : body.timeOfBirth ?? null,
      timeAccuracy: body.timeAccuracy,
      placeName: body.placeName,
      placeCountry: body.placeCountry ?? null,
      latitude: body.latitude,
      longitude: body.longitude,
      timezone: body.timezone,
      isPrimary: existingCount === 0,
    },
  });

  if (existingCount === 0 && !auth.user.onboardingDone) {
    await db.user.update({ where: { id: auth.user.id }, data: { onboardingDone: true } });
    await db.notification.create({
      data: {
        userId: auth.user.id,
        type: "daily",
        title: "Your chart is ready",
        body: "Ask your chart anything — answers are based on your birth details.",
      },
    });
  }

  return ok(profile);
}
