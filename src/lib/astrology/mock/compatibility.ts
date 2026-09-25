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
import { planetName, type EngineLocale } from "../names";

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

// ---------------------------------------------------------------- koota labels (Hindi)

const KOOTA_NAME_HI: Record<string, string> = {
  varna: "वर्ण",
  vashya: "वश्य",
  tara: "तारा",
  yoni: "योनि",
  "graha-maitri": "ग्रह मैत्री",
  gana: "गण",
  bhakoot: "भकूट",
  nadi: "नाड़ी",
};

const KOOTA_HINT_HI: Record<string, string> = {
  varna: "कार्यशैली",
  vashya: "पारस्परिक सम्मान",
  tara: "साझा भाग्य",
  yoni: "सहज वृत्तियाँ",
  "graha-maitri": "मानसिक तालमेल",
  gana: "स्वभाव",
  bhakoot: "भावुक धुरी",
  nadi: "शरीर-प्रकृति",
};

const KOOTA_MEANING_HI: Record<string, string> = {
  varna: "कार्यशैलियों का आपस में सहज तालमेल",
  vashya: "एक-दूसरे के प्रति आदर और प्रभाव की सहजता",
  tara: "एक-दूसरे के लिए भाग्य और सहयोग",
  yoni: "सहज वृत्तियों और शारीरिक तालमेल का गहरापन",
  "graha-maitri": "मन का मन से सहज रूप से समझ आना",
  gana: "ऊर्जा और सामाजिक स्वभाव का तालमेल",
  bhakoot: "भावनाओं की लय और साझा दिशा",
  nadi: "परंपरा में स्वास्थ्य और वंश से जुड़ा तालमेल",
};

const VARNA_HI: Record<string, string> = {
  Brahmin: "ब्राह्मण",
  Kshatriya: "क्षत्रिय",
  Vaishya: "वैश्य",
  Shudra: "शूद्र",
};

const GANA_HI: Record<string, string> = {
  Deva: "देव",
  Manushya: "मनुष्य",
  Rakshasa: "राक्षस",
};

const YONI_HI: Record<string, string> = {
  Horse: "घोड़ा",
  Elephant: "हाथी",
  Sheep: "भेड़",
  Serpent: "सर्प",
  Dog: "कुत्ता",
  Cat: "बिल्ली",
  Rat: "चूहा",
  Cow: "गाय",
  Buffalo: "भैंस",
  Tiger: "बाघ",
  Hare: "खरगोश",
  Monkey: "बंदर",
  Mongoose: "नेवला",
  Lion: "शेर",
};

const NADI_HI: Record<string, string> = {
  Adi: "आदि",
  Madhya: "मध्य",
  Antya: "अंत्य",
};

const VASHYA_HI: Record<string, string> = {
  "Vanachara (wild)": "वनचर (जंगली)",
  "Chatushpada (tame)": "चतुष्पद (पालतू)",
  "Manava (human)": "मानव",
  "Jalachara (water)": "जलचर",
};

const RELATION_HI: Record<string, string> = {
  friend: "मित्रता",
  enemy: "तनाव",
  neutral: "उदासीन",
};

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
  provider: CompatibilityResult["provider"],
  locale: EngineLocale = "en"
): CompatibilityResult {
  const nakA = Math.floor(a.moonLongitude / (360 / 27)) % 27;
  const nakB = Math.floor(b.moonLongitude / (360 / 27)) % 27;
  const signA = Math.floor(a.moonLongitude / 30) % 12;
  const signB = Math.floor(b.moonLongitude / 30) % 12;
  const hi = locale === "hi";

  const kootas: KootaScore[] = [];

  // 1. Varna (1) — temperament castes
  {
    const va = VARNA_BY_ELEMENT[signElement(signA)];
    const vb = VARNA_BY_ELEMENT[signElement(signB)];
    const rank: Record<string, number> = { Shudra: 1, Vaishya: 2, Kshatriya: 3, Brahmin: 4 };
    const score = rank[va] === rank[vb] ? 1 : Math.abs(rank[va] - rank[vb]) === 1 ? 0.5 : 0;
    kootas.push({
      key: "varna",
      name: hi ? KOOTA_NAME_HI.varna : "Varna",
      sanskritHint: hi ? KOOTA_HINT_HI.varna : "work style",
      meaning: hi ? KOOTA_MEANING_HI.varna : "How naturally your working styles fit",
      max: 1,
      score,
      detail: hi
        ? `${VARNA_HI[va] ?? va} × ${VARNA_HI[vb] ?? vb} — ${score >= 1 ? "काफ़ी मिलती-जुलती कार्यशैली" : score > 0 ? "पास-पास की शैलियाँ — थोड़ी समझ से पुल बन जाता है" : "अलग शैलियाँ; जान-बूझकर बातचीत करनी होगी"}`
        : `${va} × ${vb} — ${score >= 1 ? "similar approach" : score > 0 ? "adjacent styles, easy to bridge" : "different styles; needs conscious communication"}`,
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
      name: hi ? KOOTA_NAME_HI.vashya : "Vashya",
      sanskritHint: hi ? KOOTA_HINT_HI.vashya : "mutual respect",
      meaning: hi ? KOOTA_MEANING_HI.vashya : "Ease of influencing and respecting each other",
      max: 2,
      score,
      detail: hi
        ? `${VASHYA_HI[vA] ?? vA} × ${VASHYA_HI[vB] ?? vB} — ${score === 2 ? "स्वाभाविक पारस्परिक सम्मान" : "अलग प्रकृतियाँ; सम्मान मान लेने जैसा नहीं, बनाना पड़ता है"}`
        : `${vA} × ${vB} — ${score === 2 ? "natural mutual respect" : "different natures; respect is built, not assumed"}`,
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
      name: hi ? KOOTA_NAME_HI.tara : "Tara",
      sanskritHint: hi ? KOOTA_HINT_HI.tara : "shared luck",
      meaning: hi ? KOOTA_MEANING_HI.tara : "Whether you bring out fortune in each other",
      max: 3,
      score,
      detail: hi
        ? `तारा ${taraA} और ${taraB} — ${score === 3 ? "दोनों दिशाओं में सहयोग" : score > 0 ? "एक दिशा में सहयोग" : "असमान दौरों में धैर्य चाहिए"}`
        : `Tara ${taraA} & ${taraB} — ${score === 3 ? "mutually supportive" : score > 0 ? "one-directional support" : "needs patience through uneven phases"}`,
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
      name: hi ? KOOTA_NAME_HI.yoni : "Yoni",
      sanskritHint: hi ? KOOTA_HINT_HI.yoni : "instincts",
      meaning: hi ? KOOTA_MEANING_HI.yoni : "Instinctive comfort and physical compatibility",
      max: 4,
      score,
      detail: hi
        ? `${YONI_HI[yA] ?? yA} × ${YONI_HI[yB] ?? yB} — ${score === 4 ? "बहुत मिलती-जुलती वृत्तियाँ" : score === 0 ? "बिल्कुल अलग वृत्तियाँ; जागरूकता काम आती है" : "एक-दूसरे को पूरा करने वाली वृत्तियाँ"}`
        : `${yA} × ${yB} — ${score === 4 ? "very similar instincts" : score === 0 ? "strongly different instincts; awareness helps" : "complementary instincts"}`,
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
      name: hi ? KOOTA_NAME_HI["graha-maitri"] : "Graha Maitri",
      sanskritHint: hi ? KOOTA_HINT_HI["graha-maitri"] : "mental chemistry",
      meaning: hi ? KOOTA_MEANING_HI["graha-maitri"] : "How easily your minds understand each other",
      max: 5,
      score,
      detail: hi
        ? `${planetName(lordA, locale)}–${planetName(lordB, locale)} संबंध: ${RELATION_HI[relA] ?? relA} — ${score >= 4 ? "गहरा मानसिक तालमेल" : score >= 2 ? "मेहनत से बनने वाला तालमेल" : "ग़लतफ़हमी की गुंजाइश; थोड़ी ज़्यादा बात करें"}`
        : `${lordA}–${lordB} relation: ${relA} — ${score >= 4 ? "strong mental rapport" : score >= 2 ? "workable with effort" : "misunderstandings are possible; talk more"}`,
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
      name: hi ? KOOTA_NAME_HI.gana : "Gana",
      sanskritHint: hi ? KOOTA_HINT_HI.gana : "temperament",
      meaning: hi ? KOOTA_MEANING_HI.gana : "Energy levels and social temperament match",
      max: 6,
      score,
      detail: hi
        ? `${GANA_HI[gA] ?? gA} × ${GANA_HI[gB] ?? gB} — ${score >= 5 ? "बहुत मिलती हुई ऊर्जा" : score >= 3 ? "संभाले जा सकने लायक अंतर" : "साफ़ तौर पर अलग स्वभाव; एक-दूसरे की रफ़्तार का सम्मान करें"}`
        : `${gA} × ${gB} — ${score >= 5 ? "very similar energy" : score >= 3 ? "manageable difference" : "markedly different temperaments; respect each other's pace"}`,
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
      name: hi ? KOOTA_NAME_HI.bhakoot : "Bhakoot",
      sanskritHint: hi ? KOOTA_HINT_HI.bhakoot : "emotional axis",
      meaning: hi ? KOOTA_MEANING_HI.bhakoot : "Emotional wavelength and shared direction",
      max: 7,
      score,
      detail: hi
        ? good
          ? "एक ही या ठीक सामने की राशियाँ — मान्य और मज़बूत भावुक धुरी"
          : `${d1}/${d2} धुरी — परंपरा इसे परिपक्वता माँगने वाली वृद्धि-धुरी मानती है`
        : good
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
      name: hi ? KOOTA_NAME_HI.nadi : "Nadi",
      sanskritHint: hi ? KOOTA_HINT_HI.nadi : "constitution",
      meaning: hi ? KOOTA_MEANING_HI.nadi : "Traditional health & hereditary compatibility",
      max: 8,
      score,
      detail: hi
        ? `${NADI_HI[nA] ?? nA} × ${NADI_HI[nB] ?? nB} — ${score > 0 ? "अलग प्रकृतियाँ — शुभ माना जाता है" : "एक ही नाड़ी — परंपरा में चिह्नित, पर अक्सर अन्य कारक संतुलित कर देते हैं"}`
        : `${nA} × ${nB} — ${score > 0 ? "different constitutions: considered favourable" : "same Nadi: traditionally flagged, often balanced by other factors"}`,
    });
  }

  const totalScore = kootas.reduce((s, k) => s + k.score, 0);

  const manglikA = marsManglik(a.marsSignIndex, a.ascSignIndex, signA);
  const manglikB = marsManglik(b.marsSignIndex, b.ascSignIndex, signB);

  // Themes from strongest / weakest kootas
  const sorted = [...kootas].sort((x, y) => y.score / y.max - x.score / x.max);
  const strong = sorted.slice(0, 2);
  const weak = sorted.slice(-2);
  const joinNames = (list: KootaScore[]) => list.map((k) => k.name).join(hi ? " और " : " and ");
  const joinMeanings = (list: KootaScore[]) =>
    list
      .map((k) => (hi ? k.meaning : k.meaning.toLowerCase()))
      .join(hi ? " और " : ", and ");
  const themes = hi
    ? [
        {
          title: "जहाँ आप सहज रूप से मिलते हैं",
          body: `${joinNames(strong)} दोनों का स्कोर अच्छा है — ${joinMeanings(strong)} — ये बातें आपके बीच आसानी से बनती हैं।`,
        },
        {
          title: "जहाँ समझ बनानी होगी",
          body: `${joinNames(weak)} दोनों का स्कोर कम है — ${joinMeanings(weak)} — इन पर जान-बूझकर ध्यान देना पड़ सकता है। यह सामान्य है; कोई भी जोड़ी हर जगह ऊँचा स्कोर नहीं पाती।`,
        },
        {
          title: "मांगलिक (मंगल) स्थिति",
          body: manglikA && manglikB
            ? "दोनों कुंडलियों में मंगल मांगलिक स्थिति में है — परंपरा इसे आपस में निरस्त होना मानती है।"
            : manglikA || manglikB
              ? "एक कुंडली में मंगल मांगलिक स्थिति में है। व्यवहार में यह कई कारकों में से एक ही है; ज्योतिषी निष्कर्ष निकालने से पहले पूरी कुंडली के साथ देखते हैं।"
              : "दोनों में से किसी कुंडली में मंगल मांगलिक स्थिति में नहीं है।",
        },
      ]
    : [
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
    hi
      ? totalScore >= 32
        ? "परंपरा में बहुत ही अनुकूल जोड़ी मानी जाती है"
        : totalScore >= 24
          ? "परंपरा में अनुकूल जोड़ी मानी जाती है"
          : totalScore >= 18
            ? "चलने-योग्य जोड़ी — कम स्कोर वाले पहलुओं को बस थोड़ी समझ चाहिए"
            : "परंपरागत पैमानों पर कठिन स्कोर — ऐसे स्कोर वाली कई जोड़ियाँ जागरूकता से ख़ुशहाल रहती हैं"
      : totalScore >= 32
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
      note: hi
        ? "मांगलिक अकेला एक परंपरागत कारक है, कोई अंतिम निष्कर्ष नहीं। ज्योतिषी इसे आम तौर पर पूरी कुंडली के साथ तौलते हैं।"
        : "Manglik is a single traditional factor, not a verdict. Astrologers usually weigh it with the complete chart.",
    },
    themes,
    disclaimers: hi
      ? [
          "यह स्कोर एक परंपरागत जाँच-पैमाना है, आपके रिश्ते पर फ़ैसला नहीं।",
          "अष्टकूट केवल चंद्र स्थितियों की तुलना करता है। पूरा विश्लेषण दोनों कुंडलियों को पूरी तरह तौलता है।",
          "डेमो डेटा — विकास के लिए मॉक इंजन से बनाया गया।",
        ]
      : [
          "This score is a traditional screening tool, not a verdict on your relationship.",
          "Ashtakoota compares Moon positions only. A full analysis weighs both complete charts.",
          "Demo data — generated by a mock engine for development.",
        ],
  };
}
