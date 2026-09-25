/**
 * MOCK ENGINE — Vimshottari-style dasha timeline (structure is traditional,
 * values are demo-grade). Deterministic from the natal Moon position.
 */

import {
  DASHA_ORDER,
  type PlanetName,
  type DashaPeriod,
  type DashaSubPeriod,
  type DashaInfo,
} from "../types";
import { LORD_MEANING_HI, planetName, type EngineLocale } from "../names";

const YEAR_MS = 365.2425 * 86400000;

function yearsToMs(years: number): number {
  return years * YEAR_MS;
}

interface RawPeriod {
  lord: PlanetName;
  startMs: number;
  endMs: number;
  parent: PlanetName;
}

/**
 * Build the 120-year Vimshottari chain from birth.
 * @param moonLongitude natal sidereal Moon longitude
 * @param birthMs birth instant (UTC ms)
 */
function buildMahaChain(moonLongitude: number, birthMs: number): RawPeriod[] {
  const nakIndex = Math.floor(moonLongitude / (360 / 27));
  const traversed = (moonLongitude % (360 / 27)) / (360 / 27);
  const birthLordPos = nakIndex % 9;
  const birthLord = DASHA_ORDER[birthLordPos];
  const balanceYears = birthLord.years * (1 - traversed);

  const chain: RawPeriod[] = [];
  let cursor = birthMs;
  // the partial first mahadasha (balance at birth)
  chain.push({
    lord: birthLord.lord,
    startMs: cursor,
    endMs: cursor + yearsToMs(balanceYears),
    parent: birthLord.lord,
  });
  cursor += yearsToMs(balanceYears);
  for (let i = 1; i <= 8; i++) {
    const { lord, years } = DASHA_ORDER[(birthLordPos + i) % 9];
    chain.push({ lord, startMs: cursor, endMs: cursor + yearsToMs(years), parent: lord });
    cursor += yearsToMs(years);
  }
  return chain;
}

/** Antardasha subdivision of a mahadasha (first sub may be partial at birth). */
function buildAntarChain(maha: RawPeriod, isBirthMaha: boolean): RawPeriod[] {
  const mahaYears = (maha.endMs - maha.startMs) / YEAR_MS;
  const mahaPos = DASHA_ORDER.findIndex((d) => d.lord === maha.lord);
  const out: RawPeriod[] = [];
  let cursor = maha.startMs;
  for (let i = 0; i < 9; i++) {
    const { lord, years } = DASHA_ORDER[(mahaPos + i) % 9];
    // sub-period span = subYears × mahaYears / 120 (Vimshottari proportion)
    const span = yearsToMs((years * mahaYears) / 120);
    out.push({ lord, startMs: cursor, endMs: cursor + span, parent: maha.lord });
    cursor += span;
  }
  void isBirthMaha;
  // clamp to the mahadasha bounds (rounding + birth-partial cases)
  if (out.length) out[out.length - 1].endMs = maha.endMs;
  return out;
}

/** Pratyantardasha subdivision of an antardasha. */
function buildPratyantarChain(antar: RawPeriod): RawPeriod[] {
  const antarYears = (antar.endMs - antar.startMs) / YEAR_MS;
  const antarPos = DASHA_ORDER.findIndex((d) => d.lord === antar.lord);
  const out: RawPeriod[] = [];
  let cursor = antar.startMs;
  for (let i = 0; i < 9; i++) {
    const { lord, years } = DASHA_ORDER[(antarPos + i) % 9];
    // sub-sub span = subYears × antarYears / 120 (same proportion rule)
    const span = yearsToMs((years * antarYears) / 120);
    out.push({ lord, startMs: cursor, endMs: cursor + span, parent: antar.lord });
    cursor += span;
  }
  if (out.length) out[out.length - 1].endMs = antar.endMs;
  return out;
}

const toPeriod = (p: RawPeriod): DashaPeriod => ({
  lord: p.lord,
  start: new Date(p.startMs).toISOString(),
  end: new Date(p.endMs).toISOString(),
});

const toSub = (p: RawPeriod): DashaSubPeriod => ({
  lord: p.lord,
  start: new Date(p.startMs).toISOString(),
  end: new Date(p.endMs).toISOString(),
  parent: p.parent,
});

// ---------------------------------------------------------------- readings

const LORD_MEANING: Record<PlanetName, string> = {
  Sun: "identity, confidence and visibility",
  Moon: "emotions, home and connection",
  Mars: "energy, courage and direct action",
  Mercury: "learning, communication and trade",
  Jupiter: "growth, guidance and expansion",
  Venus: "comfort, relationships and beauty",
  Saturn: "structure, patience and long-term effort",
  Rahu: "ambition, novelty and growth beyond the familiar",
  Ketu: "reflection, detachment and inner clarity",
};

const LORD_PHASE_ADVICE: Record<PlanetName, string> = {
  Sun: "a phase to step up and be seen for your work",
  Moon: "a phase that favours emotional grounding and close bonds",
  Mars: "a phase of high drive — channel it into one clear goal",
  Mercury: "a strong phase for study, negotiation and skill-building",
  Jupiter: "a phase where learning, mentors and opportunities tend to grow",
  Venus: "a phase that favours relationships, design and enjoyment",
  Saturn: "a slow, steady phase — consistency matters more than speed",
  Rahu: "a restless growth phase — big appetite, needs focus",
  Ketu: "an inward phase — stepping back can move you forward",
};

const LORD_PHASE_ADVICE_HI: Record<PlanetName, string> = {
  Sun: "एक ऐसा दौर जब आप काम के लिए आगे आएँ और सराहे जाएँ",
  Moon: "एक ऐसा दौर जो भावनाओं को सींचने और अपने ज़रूरी लोगों से जुड़े रहने में सहायक है",
  Mars: "एक ऐसा दौर जब ऊर्जा ऊँची रहती है, इसलिए इसे एक स्पष्ट लक्ष्य पर केंद्रित रखना ज़रूरी है",
  Mercury: "एक ऐसा दौर जो पढ़ाई, बातचीत और नए कौशल के लिए ख़ासा अनुकूल है",
  Jupiter: "एक ऐसा दौर जब सीखना, मार्गदर्शन और अवसर धीरे-धीरे बढ़ते हैं",
  Venus: "एक ऐसा दौर जो रिश्तों, सौंदर्य और जीवन के छोटे सुखों के लिए अनुकूल है",
  Saturn: "एक ऐसा दौर जो धीमा पर स्थिर है, जहाँ रफ़्तार से ज़्यादा निरंतरता काम आती है",
  Rahu: "एक ऐसा दौर जब इच्छाएँ और उत्साह बड़े होते हैं, इसलिए ध्यान एक जगह रखना ज़रूरी है",
  Ketu: "एक ऐसा दौर जो भीतर मुड़ने का है, जहाँ एक कदम पीछे हटना भी आगे ले जाता है",
};

export function buildDasha(
  moonLongitude: number,
  birthMs: number,
  asOf: Date,
  provider: DashaInfo["provider"],
  locale: EngineLocale = "en"
): DashaInfo {
  const now = asOf.getTime();
  const maha = buildMahaChain(moonLongitude, birthMs);
  const currentMaha = maha.find((m) => now >= m.startMs && now < m.endMs) ?? maha[maha.length - 1];
  const antar = buildAntarChain(currentMaha, maha.indexOf(currentMaha) === 0);
  const currentAntar = antar.find((a) => now >= a.startMs && now < a.endMs) ?? antar[antar.length - 1];
  const pratyantar = buildPratyantarChain(currentAntar);
  const currentPraty =
    pratyantar.find((p) => now >= p.startMs && now < p.endMs) ?? pratyantar[pratyantar.length - 1];

  const timeline = maha.map((m) => {
    const isActive = m === currentMaha;
    const progress = isActive
      ? Math.min(1, Math.max(0, (now - m.startMs) / (m.endMs - m.startMs)))
      : 0;
    return { ...toPeriod(m), isActive, progress: Math.round(progress * 1000) / 1000 };
  });

  const fmtMY = (ms: number) =>
    new Date(ms).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", {
      month: "short",
      year: "numeric",
    });

  const simpleReading =
    locale === "hi"
      ? {
          headline: `आप ${planetName(currentMaha.lord, locale)} दशा में हैं (${LORD_MEANING_HI[currentMaha.lord]})`,
          body: `${fmtMY(currentMaha.startMs)} से आपकी मुख्य ग्रह-दशा ${planetName(currentMaha.lord, locale)} के नेतृत्व में चल रही है — परंपरा इसे ${LORD_MEANING_HI[currentMaha.lord]} से जोड़ती है। इसी के भीतर ${planetName(currentAntar.lord, locale)} (${LORD_MEANING_HI[currentAntar.lord]}) की उप-दशा ${fmtMY(currentAntar.endMs)} तक रहेगी। परंपरागत ज्योतिष इसे इस तरह पढ़ता है — ${LORD_PHASE_ADVICE_HI[currentMaha.lord]}।`,
        }
      : {
          headline: `You are in a ${currentMaha.lord} phase (${LORD_MEANING[currentMaha.lord]})`,
          body: `Since ${new Date(currentMaha.startMs).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} your main planetary period is led by ${currentMaha.lord} — traditionally linked to ${LORD_MEANING[currentMaha.lord]}. Within it, the sub-period of ${currentAntar.lord} (${LORD_MEANING[currentAntar.lord]}) runs until ${new Date(currentAntar.endMs).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}. Traditional astrology reads this as ${LORD_PHASE_ADVICE[currentMaha.lord]}.`,
        };

  return {
    provider,
    asOf: asOf.toISOString(),
    current: {
      mahadasha: toPeriod(currentMaha),
      antardasha: toSub(currentAntar),
      pratyantardasha: toSub(currentPraty),
    },
    timeline,
    antardashas: antar.map((a) => ({ ...toSub(a), isActive: a === currentAntar })),
    pratyantardashas: pratyantar.map(toSub),
    simpleReading,
  };
}

export function lordMeaning(lord: PlanetName): string {
  return LORD_MEANING[lord];
}
