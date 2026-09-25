import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, parseBody, isParseFailure, requireUser, isAuthFailure } from "@/lib/api";

const ticketSchema = z.object({
  category: z.enum(["general", "billing", "privacy", "astrologer", "bug"]),
  subject: z.string().trim().min(1, "Subject is required").max(120),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

/**
 * POST /api/support — creates a SupportTicket. In this build no human replies
 * yet; the ticket is stored and referenced by id. Reports about an astrologer
 * are meant to be reviewed seriously (see the TrustNote in SupportScreen).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, ticketSchema);
  if (isParseFailure(body)) return body;

  const ticket = await db.supportTicket.create({
    data: {
      userId: auth.user.id,
      category: body.category,
      subject: body.subject,
      message: body.message,
      status: "open",
    },
  });

  return ok({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt,
    },
  });
}
