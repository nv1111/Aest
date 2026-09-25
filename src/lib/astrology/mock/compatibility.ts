/**
 * MOCK ENGINE — Ashtakoota-style compatibility (36 gunas).
 * The STRUCTURE follows the traditional eight kootas; several tables are
 * simplified approximations. Demo-grade, deterministic, clearly labeled.
 */

import {
  NAKSHATRAS,
  SIGNS,
  type CompatibilityResult,
  type KootaScore,
  type PlanetName,
  SIGN_LORDS,
} from "../types";
import { houseFromSign } from "./positions";

// ---------------------------------------------------------------- tables

const GANA_TABLE = [
  "Deva", "Manushya", "Rakshasa", "Manushya", "Deva", "Manushya", "Deva", "Deva", "Rakshasa",
  "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Deva", "Rakshasa", "Deva", "Rakshasa",
  "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva",
];

const YONI_TABLE = [
  "Horse", "Elephant", "Sheep", "Serpent", "Serpent", "Dog", "Cat", "Sheep", "Cat",
  "Rat", "Rat", "Cow", "Buffalo", "Tiger", "Buffalo", "Tiger", "Hare", "Hare",
  "Dog", "Monkey", "Mongoose", "Monkey", "Lion", "Horse", "Lion", "Cow", "Elephant",
];

const YONI_ENEMIES: [string, string][] = [
  ["Cow", "Tiger"],
  ["Horse", "Buffalo"],
  ["Elephant", "Lion"],
  ["Dog", "Hare"],
  ["Serpent", "Mongoose"],
  ["Monkey", "Sheep"],
  ["Cat", "Rat"],
  ["Lion", "Elephant"],
];

const NADI_TABLE = [
  "Adi", "Madhya", "Antya", "Adi", "Madhya", "Antya", "Adi", "Madhya", "Antya",
  "Adi", "Madhya", "Antya", "Adi", "Madhya", "Antya", "Adi", "Madhya", "Antya",
  "Adi", "Madhya", "Antya", "Adi", "Madhya", "Antya", "Adi", "Madhya", "Antya",
];

const VARNA_BY_ELEMENT: Record<string, string> = {
  fire: "Kshatriya",
  earth: "Vaishya",
  air: "Shudra",
  water: "Brahmin",
};

function signElement(signIndex: number): "fire" | "earth" | "air" | "water" {
  return (["fire", "earth", "air", "water"] as const)[signIndex % 4];
}

function signVashya(signIndex: number): string {
  const el = signElement(signIndex);
  return el === "fire" ? "Vanachara (wild)" : el === "earth" ? "Chatushpada (tame)" : el === "air" ? "Manava (human)" : "Jalachara (water)";
}

/** Natural friendship matrix for graha maitri (7 classical lords). */
const FRIENDS: Record<string, string[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
};

function relation(a: string, b: string): "friend" | "enemy" | "neutral" {
  if (a === b) return "friend";
  if ((FRIENDS[a] ?? []).includes(b)) return "friend";
  const enemiesA = Object.keys(FRIENDS).filter(
    (k) => k !== a && !(FRIENDS[a] ?? []).includes(k) && !(FRIENDS[k] ?? []).includes(a)
  );
  if (enemiesA.includes(b)) return "enemy";
  return "neutral";
}

// ---------------------------------------------------------------- inputs

export interface CompatInput {
  id: string;
  name: string;
  moonLongitude: number;
  ascSignIndex: number;
  marsSignIndex: number;
  marsHouseFromMoon: number;
}

function marsManglik(marsSignIndex: number, ascSignIndex: number, moonSignIndex: number): boolean {
  const fromAsc = houseFromSign(marsSignIndex, ascSignIndex);
  const fromMoon = houseFromSign(marsSignIndex, moonSignIndex);
  const spots = [1, 2, 4, 7, 8, 12];
  return spots.includes(fromAsc) || spots.includes(fromMoon);
}

// ---------------------------------------------------------------- kootas

export function buildCompatibility(
  a: CompatInput,
  b: CompatInput,
  provider: CompatibilityResult["provider"]
): CompatibilityResult {
  const nakA = Math.floor(a.moonLongitude / (360 / 27)) % 27;
  const nakB = Math.floor(b.moonLongitude / (360 / 27)) % 27;
  const signA = Math.floor(a.moonLongitude / 30) % 12;
  const signB = Math.floor(b.moonLongitude / 30) % 12;

  const kootas: KootaScore[] = [];

  // 1. Varna (1) — temperament castes
  {
    const va = VARNA_BY_ELEMENT[signElement(signA)];
    const vb = VARNA_BY_ELEMENT[signElement(signB)];
    const rank: Record<string, number> = { Shudra: 1, Vaishya: 2, Kshatriya: 3, Brahmin: 4 };
    const score = rank[va] === rank[vb] ? 1 : Math.abs(rank[va] - rank[vb]) === 1 ? 0.5 : 0;
    kootas.push({
      key: "varna",
      name: "Varna",
      sanskritHint: "work style",
      meaning: "How naturally your working styles fit",
      max: 1,
      score,
      detail: `${va} × ${vb} — ${score >= 1 ? "similar approach" : score > 0 ? "adjacent styles, easy to bridge" : "different styles; needs conscious communication"}`,
    });
  }

  // 2. Vashya (2) — mutual influence
  {
    const vA = signVashya(signA);
    const vB = signVashya(signB);
    const same = vA === vB;
    const score = same ? 2 : vA.split(" ")[0] === vB.split(" ")[0] ? 2 : 1;
    kootas.push({
      key: "vashya",
      name: "Vashya",
      sanskritHint: "mutual respect",
      meaning: "Ease of influencing and respecting each other",
      max: 2,
      score,
      detail: `${vA} × ${vB} — ${score === 2 ? "natural mutual respect" : "different natures; respect is built, not assumed"}`,
    });
  }

  // 3. Tara (3) — mutual fortune
  {
    const count = (from: number, to: number) => {
      const n = ((to - from + 27) % 27) + 1;
      return ((n - 1) % 9) + 1;
    };
    const taraA = count(nakA, nakB); // from A to B
    const taraB = count(nakB, nakA);
    const good = (t: number) => [2, 4, 6, 8, 9].includes(t);
    let score = 0;
    if (good(taraA)) score += 1.5;
    if (good(taraB)) score += 1.5;
    kootas.push({
      key: "tara",
      name: "Tara",
      sanskritHint: "shared luck",
      meaning: "Whether you bring out fortune in each other",
      max: 3,
      score,
      detail: `Tara ${taraA} & ${taraB} — ${score === 3 ? "mutually supportive" : score > 0 ? "one-directional support" : "needs patience through uneven phases"}`,
    });
  }

  // 4. Yoni (4) — instinctive nature
  {
    const yA = YONI_TABLE[nakA];
    const yB = YONI_TABLE[nakB];
    const enemy = YONI_ENEMIES.some(
      ([x, y]) => (x === yA && y === yB) || (x === yB && y === yA)
    );
    const score = yA === yB ? 4 : enemy ? 0 : 2;
    kootas.push({
      key: "yoni",
      name: "Yoni",
      sanskritHint: "instincts",
      meaning: "Instinctive comfort and physical compatibility",
      max: 4,
      score,
      detail: `${yA} × ${yB} — ${score === 4 ? "very similar instincts" : score === 0 ? "strongly different instincts; awareness helps" : "complementary instincts"}`,
    });
  }

  // 5. Graha Maitri (5) — mental chemistry
  {
    const lordA = SIGN_LORDS[SIGNS[signA]];
    const lordB = SIGN_LORDS[SIGNS[signB]];
    const relA = relation(lordA, lordB);
    const relB = relation(lordB, lordA);
    const pair = [relA, relB];
    let score: number;
    if (pair.includes("friend") && !pair.includes("enemy") && !pair.includes("neutral")) score = 5;
    else if (pair.includes("friend") && pair.includes("neutral")) score = 4;
    else if (pair.every((r) => r === "neutral")) score = 3;
    else if (pair.includes("enemy") && pair.includes("neutral")) score = 1.5;
    else score = 0;
    kootas.push({
      key: "graha-maitri",
      name: "Graha Maitri",
      sanskritHint: "mental chemistry",
      meaning: "How easily your minds understand each other",
      max: 5,
      score,
      detail: `${lordA}–${lordB} relation: ${relA} — ${score >= 4 ? "strong mental rapport" : score >= 2 ? "workable with effort" : "misunderstandings are possible; talk more"}`,
    });
  }

  // 6. Gana (6) — temperament
  {
    const gA = GANA_TABLE[nakA];
    const gB = GANA_TABLE[nakB];
    const pair = [gA, gB].sort().join("-");
    const table: Record<string, number> = {
      "Deva-Deva": 6, "Manushya-Manushya": 6, "Rakshasa-Rakshasa": 6,
      "Deva-Manushya": 5, "Deva-Rakshasa": 1, "Manushya-Rakshasa": 0,
    };
    const score = table[pair] ?? 3;
    kootas.push({
      key: "gana",
      name: "Gana",
      sanskritHint: "temperament",
      meaning: "Energy levels and social temperament match",
      max: 6,
      score,
      detail: `${gA} × ${gB} — ${score >= 5 ? "very similar energy" : score >= 3 ? "manageable difference" : "markedly different temperaments; respect each other's pace"}`,
    });
  }

  // 7. Bhakoot (7) — emotional axis
  {
    const d1 = ((signB - signA + 12) % 12) + 1;
    const d2 = ((signA - signB + 12) % 12) + 1;
    const good = (d1 === 1 && d2 === 1) || (d1 === 7 && d2 === 7);
    const score = good ? 7 : 0;
    kootas.push({
      key: "bhakoot",
      name: "Bhakoot",
      sanskritHint: "emotional axis",
      meaning: "Emotional wavelength and shared direction",
      max: 7,
      score,
      detail: good
        ? "Same or opposite signs — a recognised strong emotional axis"
        : `${d1}/${d2} axis — traditionally considered a growth axis that needs maturity`,
    });
  }

  // 8. Nadi (8) — constitution
  {
    const nA = NADI_TABLE[nakA];
    const nB = NADI_TABLE[nakB];
    const score = nA !== nB ? 8 : 0;
    kootas.push({
      key: "nadi",
      name: "Nadi",
      sanskritHint: "constitution",
      meaning: "Traditional health & hereditary compatibility",
      max: 8,
      score,
      detail: `${nA} × ${nB} — ${score > 0 ? "different constitutions: considered favourable" : "same Nadi: traditionally flagged, often balanced by other factors"}`,
    });
  }

  const totalScore = kootas.reduce((s, k) => s + k.score, 0);

  const manglikA = marsManglik(a.marsSignIndex, a.ascSignIndex, signA);
  const manglikB = marsManglik(b.marsSignIndex, b.ascSignIndex, signB);

  // Themes from strongest / weakest kootas
  const sorted = [...kootas].sort((x, y) => y.score / y.max - x.score / x.max);
  const strong = sorted.slice(0, 2);
  const weak = sorted.slice(-2);
  const themes = [
    {
      title: "Where you naturally click",
      body: `${strong.map((k) => k.name).join(" and ")} score well — ${strong
        .map((k) => k.meaning.toLowerCase())
        .join(", and ")} tend to come easily between you.`,
    },
    {
      title: "Where understanding is needed",
      body: `${weak.map((k) => k.name).join(" and ")} score lower — ${weak
        .map((k) => k.meaning.toLowerCase())
        .join(", and ")} may need conscious effort. This is normal; no pair scores high everywhere.`,
    },
    {
      title: "Manglik (Mars) position",
      body: manglikA && manglikB
        ? "Both charts show Mars in a Manglik position — traditionally considered mutually neutralising."
        : manglikA || manglikB
          ? "One chart shows Mars in a Manglik position. In practice this is one factor among many; astrologers often examine it with the full chart before drawing conclusions."
          : "Neither chart shows Mars in a Manglik position.",
    },
  ];

  const verdict =
    totalScore >= 32
      ? "Traditionally considered a very harmonious match"
      : totalScore >= 24
        ? "Traditionally considered a harmonious match"
        : totalScore >= 18
          ? "A workable match — the low-scoring areas simply need understanding"
          : "A challenging score in traditional terms — many couples with similar scores thrive with awareness";

  return {
    provider,
    profileA: { id: a.id, name: a.name },
    profileB: { id: b.id, name: b.name },
    totalScore: Math.round(totalScore * 10) / 10,
    maxScore: 36,
    verdict,
    kootas,
    manglik: {
      a: manglikA,
      b: manglikB,
      note:
        "Manglik is a single traditional factor, not a verdict. Astrologers usually weigh it with the complete chart.",
    },
    themes,
    disclaimers: [
      "This score is a traditional screening tool, not a verdict on your relationship.",
      "Ashtakoota compares Moon positions only. A full analysis weighs both complete charts.",
      "Demo data — generated by a mock engine for development.",
    ],
  };
}
