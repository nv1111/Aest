import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

const bodySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60).optional(),
    language: z.enum(["en"]).optional(),
  })
  .refine((d) => d.name !== undefined || d.language !== undefined, {
    message: "Nothing to update",
  });

/** POST /api/user — updates profile fields (name / language). GET /api/auth/me exists. */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  if (body.name !== undefined && !body.name) {
    return fail(422, "invalid_name", "Name cannot be empty.");
  }

  const user = await db.user.update({
    where: { id: auth.user.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.language !== undefined ? { language: body.language } : {}),
    },
  });

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
  });
}
