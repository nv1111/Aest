import type { Astrologer, Consultation, SupportTicket } from "@prisma/client";
import type {
  AdminAstrologerDTO,
  AdminConsultationDTO,
  AdminSupportTicketDTO,
  ConsoleConsultationDTO,
} from "@/types/console";

/**
 * Shared DTO mappers for the /api/admin/* routes (Phase 2 Super Admin
 * console). Underscore files are never routes — safe to colocate here.
 * Shapes are the fixed contracts in src/types/console.ts.
 */

/** Minimal user projection every admin DTO embeds ({id, name, phone}). */
export type AdminUserBriefRow = { id: string; name: string | null; phone: string | null };

export function userBrief(u: AdminUserBriefRow) {
  return { id: u.id, name: u.name, phone: u.phone };
}

/** ConsoleConsultationDTO — consultation row + user included + message count. */
export function consoleConsultationDTO(
  c: Consultation & { user: AdminUserBriefRow },
  messageCount: number
): ConsoleConsultationDTO {
  return {
    id: c.id,
    user: userBrief(c.user),
    mode: c.mode,
    status: c.status,
    ratePerMinute: c.ratePerMinute,
    startedAt: c.startedAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    durationSeconds: c.durationSeconds,
    totalAmount: c.totalAmount,
    summary: c.summary,
    userConsentShared: c.userConsentShared,
    createdAt: c.createdAt.toISOString(),
    messageCount,
  };
}

/** AdminAstrologerDTO — `operatedByConsole` = an AstrologerAccount row exists. */
export function adminAstrologerDTO(a: Astrologer, operatedByConsole: boolean): AdminAstrologerDTO {
  return {
    id: a.id,
    displayName: a.displayName,
    slug: a.slug,
    photoUrl: a.photoUrl,
    expertise: JSON.parse(a.expertise) as string[],
    languages: JSON.parse(a.languages) as string[],
    experienceYears: a.experienceYears,
    rating: a.rating,
    reviewCount: a.reviewCount,
    consultationCount: a.consultationCount,
    pricePerMinute: a.pricePerMinute,
    isVerified: a.isVerified,
    kycStatus: a.kycStatus,
    onlineStatus: a.onlineStatus,
    isDemo: a.isDemo,
    operatedByConsole,
  };
}

/** AdminConsultationDTO — `refundedAmount` comes from the refund groupBy. */
export function adminConsultationDTO(
  c: Consultation & { user: AdminUserBriefRow; astrologer: Pick<Astrologer, "id" | "displayName"> },
  refundedAmount: number
): AdminConsultationDTO {
  return {
    id: c.id,
    status: c.status,
    mode: c.mode,
    user: userBrief(c.user),
    astrologer: { id: c.astrologer.id, displayName: c.astrologer.displayName },
    ratePerMinute: c.ratePerMinute,
    durationSeconds: c.durationSeconds,
    totalAmount: c.totalAmount,
    refundedAmount,
    startedAt: c.startedAt?.toISOString() ?? null,
    endedAt: c.endedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    summary: c.summary,
  };
}

/** AdminSupportTicketDTO — ticket row + user included. */
export function adminSupportTicketDTO(
  t: SupportTicket & { user: AdminUserBriefRow }
): AdminSupportTicketDTO {
  return {
    id: t.id,
    subject: t.subject,
    category: t.category,
    message: t.message,
    status: t.status,
    response: t.response,
    user: userBrief(t.user),
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
  };
}
