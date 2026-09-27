import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { buildChartContext } from "@/lib/astrology/server";
import { requireConsoleAstrologer, isGuardFailure } from "../../../_shared";
import type { AstrologerContextDTO } from "@/types/console";

/**
 * GET /api/astrologer-console/consultations/[id]/context
 * → AstrologerContextDTO (the kundli side panel data).
 *
 * PRIVACY FIRST: consultation.userConsentShared === false → the DTO is
 * returned with consentShared:false and profile/chart/dasha all null — the
 * user did NOT share their birth details for this consultation, so nothing is
 * computed or exposed. The UI explains this state.
 *
 * When consent is given: the consultation user's PRIMARY birth profile is
 * resolved and the live engine computes chart + current Vimshottari dasha
 * (buildChartContext). No profile → nulls (user hasn't onboarded a chart).
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireConsoleAstrologer();
  if (isGuardFailure(guard)) return guard.response;

  const { id } = await params;
  const consultation = await db.consultation.findUnique({
    where: { id },
    select: { id: true, astrologerId: true, userId: true, userConsentShared: true },
  });
  if (!consultation || consultation.astrologerId !== guard.account.astrologerId) {
    return fail(404, "not_found", "This consultation doesn't exist.");
  }

  const user = await db.user.findUnique({
    where: { id: consultation.userId },
    select: { name: true },
  });

  const consentShared = consultation.userConsentShared;

  // no consent → DO NOT compute anything; the panel explains the state
  if (!consentShared) {
    const dto: AstrologerContextDTO = {
      consultationId: consultation.id,
      consentShared: false,
      user: { name: user?.name ?? null },
      profile: null,
      chart: null,
      dasha: null,
    };
    return ok(dto);
  }

  const ctx = await buildChartContext(consultation.userId, null);

  const dto: AstrologerContextDTO = {
    consultationId: consultation.id,
    consentShared: true,
    user: { name: user?.name ?? null },
    profile: ctx
      ? {
          name: ctx.profile.name,
          dateOfBirth: ctx.profile.dateOfBirth,
          timeOfBirth: ctx.profile.timeOfBirth,
          timeAccuracy: ctx.profile.timeAccuracy,
          place: ctx.profile.place,
        }
      : null,
    chart: ctx
      ? {
          ascendant: ctx.chart.ascendant,
          moonSign: ctx.chart.moonSign,
          sunSign: ctx.chart.sunSign,
          nakshatra: ctx.chart.nakshatra,
          nakshatraPada: ctx.chart.nakshatraPada,
          planets: ctx.chart.planets.map((pl) => ({
            planet: pl.planet,
            sign: pl.sign,
            house: pl.house,
            degree: pl.degree,
            nakshatra: pl.nakshatra,
            retrograde: pl.retrograde,
          })),
        }
      : null,
    dasha: ctx
      ? {
          mahadasha: ctx.dasha.mahadasha,
          mahadashaEnds: ctx.dasha.mahadashaEnds,
          antardasha: ctx.dasha.antardasha,
          antardashaEnds: ctx.dasha.antardashaEnds,
        }
      : null,
  };

  return ok(dto);
}
