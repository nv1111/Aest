import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requirePersona, isAuthFailure } from "@/lib/api";
import { adminAstrologerDTO } from "../../../_dto";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
});

/**
 * POST /api/admin/astrologers/[id]/kyc  body { action: approve | reject | suspend }
 *
 * - approve: kycStatus "approved",  isVerified true
 * - reject:  kycStatus "rejected",  isVerified false
 * - suspend: kycStatus "suspended", isVerified false, onlineStatus "offline"
 *   (suspension takes the astrologer off the live marketplace list immediately)
 * - 404 when the astrologer profile doesn't exist
 * → { astrologer: AdminAstrologerDTO }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  const body = await parseBody(req, actionSchema);
  if (isParseFailure(body)) return body;

  const astrologer = await db.astrologer.findUnique({ where: { id } });
  if (!astrologer) {
    return fail(404, "not_found", "This astrologer profile doesn't exist.");
  }

  const updated = await db.astrologer.update({
    where: { id },
    data: {
      kycStatus:
        body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "suspended",
      isVerified: body.action === "approve",
      ...(body.action === "suspend" ? { onlineStatus: "offline" } : {}),
    },
  });

  const account = await db.astrologerAccount.findUnique({ where: { astrologerId: id } });
  return ok({ astrologer: adminAstrologerDTO(updated, account !== null) });
}
