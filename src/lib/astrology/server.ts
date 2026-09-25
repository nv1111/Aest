import { db } from "@/lib/db";
import { getAstrologyProvider } from "./index";
import type { AstrologyInput, AstrologyProvider } from "./types";
import type { BirthProfile } from "@prisma/client";

/**
 * Server-side helpers shared by API routes (chart context for AI, profile
 * resolution). Server-only — never import from client components.
 */

export function toAstrologyInput(profile: BirthProfile): AstrologyInput {
  return {
    name: profile.name,
    dateOfBirth: profile.dateOfBirth,
    timeOfBirth: profile.timeOfBirth,
    timeAccuracy: (profile.timeAccuracy as AstrologyInput["timeAccuracy"]) ?? "exact",
    placeName: profile.placeName,
    latitude: profile.latitude,
    longitude: profile.longitude,
    timezone: profile.timezone,
  };
}

/** Resolve a profile (own or primary) → provider input. Throws typed errors. */
export async function resolveProfileInput(userId: string, profileId?: string | null) {
  let profile: BirthProfile | null = null;
  if (profileId) {
    profile = await db.birthProfile.findFirst({ where: { id: profileId, userId } });
  } else {
    profile = await db.birthProfile.findFirst({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
  }
  if (!profile) return null;
  return { profile, input: toAstrologyInput(profile) };
}

export function provider(): AstrologyProvider {
  return getAstrologyProvider();
}

/** Compact chart context for the AI prompt (bounded, no raw dumps). */
export async function buildChartContext(userId: string, profileId?: string | null) {
  const resolved = await resolveProfileInput(userId, profileId);
  if (!resolved) return null;
  const { profile, input } = resolved;
  const p = provider();

  const chart = p.getBirthChart(input);
  const dasha = p.getDasha(input);
  const transit = p.getTransit(input);

  return {
    profile: {
      name: profile.name,
      dateOfBirth: profile.dateOfBirth,
      timeOfBirth: profile.timeOfBirth,
      timeAccuracy: profile.timeAccuracy,
      place: `${profile.placeName}${profile.placeCountry ? `, ${profile.placeCountry}` : ""}`,
    },
    chart: {
      ascendant: chart.ascendant.sign,
      moonSign: chart.moonSign.sign,
      sunSign: chart.sunSign.sign,
      nakshatra: chart.nakshatra.name,
      nakshatraPada: chart.nakshatra.pada,
      planets: chart.planets.map((pl) => ({
        planet: pl.planet,
        sign: pl.sign,
        house: pl.house,
        degree: pl.degreeInSign,
        nakshatra: pl.nakshatra,
        retrograde: pl.isRetrograde,
      })),
    },
    dasha: {
      mahadasha: dasha.current.mahadasha.lord,
      mahadashaEnds: dasha.current.mahadasha.end,
      antardasha: dasha.current.antardasha.lord,
      antardashaEnds: dasha.current.antardasha.end,
      pratyantardasha: dasha.current.pratyantardasha?.lord ?? null,
    },
    transit: {
      asOf: transit.asOf,
      notable: transit.notable,
      saturn: transit.transits.find((t) => t.planet === "Saturn"),
      jupiter: transit.transits.find((t) => t.planet === "Jupiter"),
    },
  };
}

export type ChartContext = Awaited<ReturnType<typeof buildChartContext>>;
