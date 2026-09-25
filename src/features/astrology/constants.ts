/**
 * Astrology feature constants — presentation-only maps and educational copy.
 * NO calculations here (AGENTS.md rule: math lives in the provider/engine).
 * Copy strings come from the i18n dictionary so nothing is hard-coded in JSX.
 */
import { t } from "@/i18n";
import type { PlanetName } from "@/lib/astrology/types";

/** Two-letter chart abbreviations (used in the SVG chart + chips). */
export const PLANET_ABBR: Record<PlanetName, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

/** Fixed display order for planet lists. */
export const PLANET_ORDER: PlanetName[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

/** Static, plain-language "what this planet represents" copy (educational). */
export function planetMeaning(planet: PlanetName): { title: string; body: string } {
  return {
    title: t(`astrology.planet${planet}Title`),
    body: t(`astrology.planet${planet}Body`),
  };
}

/** Muted glyph tones per planet (background classes for the circular glyph). */
export const PLANET_GLYPH_CLASS: Record<PlanetName, string> = {
  Sun: "bg-accent/60 text-accent-foreground",
  Moon: "bg-secondary text-secondary-foreground",
  Mars: "bg-accent/70 text-accent-foreground",
  Mercury: "bg-secondary text-secondary-foreground",
  Jupiter: "bg-accent/50 text-accent-foreground",
  Venus: "bg-secondary text-secondary-foreground",
  Saturn: "bg-muted text-muted-foreground",
  Rahu: "bg-muted text-muted-foreground",
  Ketu: "bg-muted text-muted-foreground",
};

/** Panchang term → learn-more dialog copy. */
export const PANCHANG_LEARN: Record<string, string> = {
  tithi: "learnTithiBody",
  nakshatra: "learnNakshatraBody",
  yoga: "learnYogaBody",
  karana: "learnKaranaBody",
  vara: "learnVaraBody",
  rahuKaal: "learnRahuBody",
  abhijit: "learnAbhijitBody",
  choghadiya: "learnChoghadiyaBody",
};
