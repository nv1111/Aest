import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, parseBody, isParseFailure } from "@/lib/api";
import { requireConsoleAstrologer, isGuardFailure } from "../_shared";

/**
 * POST /api/astrologer-console/availability
 * body { onlineStatus: "online" | "away" | "offline" }
 *
 * Updates the OPERATED astrologer's presence (the marketplace list reflects
 * it immediately for customers). → { onlineStatus }
 */

const availabilitySchema = z.object({
  onlineStatus: z.enum(["online", "away", "offline"]),
});

export async function POST(req: NextRequest) {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const body = await parseBody(req, availabilitySchema);
  if (isParseFailure(body)) return body;

  await db.astrologer.update({
    where: { id: guard.account.astrologerId },
    data: { onlineStatus: body.onlineStatus },
  });

  return ok({ onlineStatus: body.onlineStatus });
}
