import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, parseBody, isParseFailure, requirePersona, isAuthFailure } from "@/lib/api";
import { adminSupportTicketDTO } from "../../../_dto";

const replySchema = z.object({
  response: z.string().trim().min(1, "Response is required").max(2000),
  resolved: z.boolean().optional(),
});

/**
 * POST /api/admin/support/[id]/reply  body { response: 1..2000, resolved? }
 *
 * - ticket must exist (404)
 * - saves the response; status → "in_progress" (or "resolved" + resolvedAt
 *   when resolved=true)
 * - notifies the ticket's user (type "event", reply preview truncated at
 *   90 characters)
 * → { ticket: AdminSupportTicketDTO }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  const body = await parseBody(req, replySchema);
  if (isParseFailure(body)) return body;

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) {
    return fail(404, "not_found", "This support ticket doesn't exist.");
  }

  const resolved = body.resolved === true;

  const updated = await db.supportTicket.update({
    where: { id },
    data: {
      response: body.response,
      status: resolved ? "resolved" : "in_progress",
      ...(resolved ? { resolvedAt: new Date() } : {}),
    },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });

  const preview =
    body.response.length > 90 ? `${body.response.slice(0, 90)}…` : body.response;
  await db.notification.create({
    data: {
      userId: ticket.userId,
      type: "event",
      title: "Support replied",
      body: preview,
    },
  });

  return ok({ ticket: adminSupportTicketDTO(updated) });
}
