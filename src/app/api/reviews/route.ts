import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure, parseBody, isParseFailure } from "@/lib/api";

/**
 * POST /api/reviews — rate a completed consultation.
 *
 * - The consultation must belong to the caller and be ended
 * - One review per consultation (unique constraint)
 * - authorName is derived from the user's own name (never exposes the phone)
 * - The astrologer's aggregate rating/reviewCount are updated incrementally
 *   (seeded platform totals stay intact, real reviews fold in correctly)
 * → { review: ReviewDTO }
 */

const bodySchema = z.object({
  consultationId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(500).optional(),
});

export interface ReviewDTO {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export function reviewDTO(r: { id: string; authorName: string; rating: number; text: string; createdAt: Date }): ReviewDTO {
  return {
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  };
}

/** "Ananya Mehta" → "Ananya M."; falls back to a privacy-safe label. */
function displayName(name: string | null): string {
  if (!name || !name.trim()) return "Tara member";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const body = await parseBody(req, bodySchema);
  if (isParseFailure(body)) return body;

  const consultation = await db.consultation.findFirst({
    where: { id: body.consultationId, userId: auth.user.id },
    include: { astrologer: true },
  });
  if (!consultation) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }
  if (consultation.status !== "ended") {
    return fail(409, "not_ended", "You can rate a consultation once it has ended.");
  }

  const existing = await db.review.findUnique({
    where: { consultationId: consultation.id },
  });
  if (existing) {
    return fail(409, "already_reviewed", "You have already rated this consultation.");
  }

  const review = await db.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        astrologerId: consultation.astrologerId,
        userId: auth.user.id,
        authorName: displayName(auth.user.name),
        rating: body.rating,
        text: body.text?.trim() ?? "",
        consultationId: consultation.id,
        isDemo: false, // genuine user-generated content (not seeded)
      },
    });

    // fold the new rating into the astrologer's aggregates incrementally
    const a = consultation.astrologer;
    const newCount = a.reviewCount + 1;
    const newRating = (a.rating * a.reviewCount + body.rating) / newCount;
    await tx.astrologer.update({
      where: { id: a.id },
      data: {
        rating: Math.round(newRating * 10) / 10,
        reviewCount: newCount,
      },
    });

    return created;
  });

  return ok({ review: reviewDTO(review) });
}
