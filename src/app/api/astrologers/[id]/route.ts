import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireUser, isAuthFailure } from "@/lib/api";
import { publicAstrologer } from "../_dto";

/**
 * GET /api/astrologers/[id] → { astrologer: AstrologerDTO, reviews: ReviewDTO[] }
 * Public fields only; reviews newest first.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await params;
  const astrologer = await db.astrologer.findUnique({
    where: { id },
    include: { reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!astrologer) {
    return fail(404, "not_found", "This astrologer profile doesn't exist.");
  }

  return ok({
    astrologer: publicAstrologer(astrologer),
    reviews: astrologer.reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
