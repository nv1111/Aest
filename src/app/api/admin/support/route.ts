import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requirePersona, isAuthFailure } from "@/lib/api";
import { adminSupportTicketDTO } from "../_dto";

/**
 * GET /api/admin/support?status=open|in_progress|resolved (filter optional —
 * none = ALL users' tickets).
 *
 * Ordering: open FIRST → in_progress → resolved; within the same status
 * newest first. Implemented as one bounded query per status group (batched in
 * a single Promise.all — same pooler-round-trip economy as the dashboard),
 * then merged in priority order and capped at 100.
 */
const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;

export async function GET(req: NextRequest) {
  const auth = await requirePersona("admin");
  if (isAuthFailure(auth)) return auth.response;

  // empty string ("?status=") counts as no filter
  const status = req.nextUrl.searchParams.get("status") || null;
  if (status != null && !(TICKET_STATUSES as readonly string[]).includes(status)) {
    return fail(422, "validation_failed", "Unknown ticket status filter.");
  }

  const groups = status ? [status] : [...TICKET_STATUSES];

  const rows = await Promise.all(
    groups.map((s) =>
      db.supportTicket.findMany({
        where: { status: s },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { id: true, name: true, phone: true } } },
      })
    )
  );

  return ok({ tickets: rows.flat().slice(0, 100).map(adminSupportTicketDTO) });
}
