import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

/**
 * POST /api/ask/interpret — no-op placeholder reserved for other features
 * (astrology screens, reports) that want to prefill contextual questions
 * in the Ask tab. Deep-linking lands client-side; nothing to compute yet.
 */
const bodySchema = z
  .object({
    topic: z.string().trim().max(120).optional(),
    screen: z.string().trim().max(60).optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  return ok({ ok: true });
}
