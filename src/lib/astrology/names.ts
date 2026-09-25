/**
 * Engine-side localization — Hindi name tables for the mock astrology engine.
 *
 * The engine computes deterministically in English (names as keys); these
 * tables render the SAME data in Devanagari when a locale=hi request asks
 * for it. Values follow standard jyotish Hindi usage. Latin digits are kept
 * everywhere (dates/times stay identical between locales).
 */

import { NAKSHATRAS, type ChoghadiyaName, type PlanetName } from "./types";

export type EngineLocale = "en" | "hi";

// ------------------------------------------------------------------ planets

export const PLANET_HI: Record<PlanetName, string> = {
  Sun: "सूर्य",
  Moon: "चंद्र",
  Mars: "मंगल",
  Mercury: "बुध",
  Jupiter: "गुरु",
  Venus: "शुक्र",
  Saturn: "शनि",
  Rahu: "राहु",
  Ketu: "केतु",
};

export function planetName(name: PlanetName, locale: EngineLocale): string {
  return locale === "hi" ? PLANET_HI[name] : name;
}

// ------------------------------------------------------------------ signs

export const SIGN_HI: Record<string, string> = {
  Aries: "मेष",
  Taurus: "वृषभ",
  Gemini: "मिथुन",
  Cancer: "कर्क",
  Leo: "सिंह",
  Virgo: "कन्या",
  Libra: "तुला",
  Scorpio: "वृश्चिक",
  Sagittarius: "धनु",
  Capricorn: "मकर",
  Aquarius: "कुंभ",
  Pisces: "मीन",
};

export function signName(name: string, locale: EngineLocale): string {
  return locale === "hi" ? SIGN_HI[name] : name;
}

// ------------------------------------------------------------------ nakshatras (27)

export const NAKSHATRA_HI: string[] = [
  "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु",
  "पुष्य", "आश्लेषा", "मघा", "पूर्व फाल्गुनी", "उत्तर फाल्गुनी", "हस्त",
  "चित्रा", "स्वाति", "विशाखा", "अनुराधा", "ज्येष्ठा", "मूल", "पूर्वाषाढ़ा",
  "उत्तराषाढ़ा", "श्रवण", "धनिष्ठा", "शतभिषा", "पूर्व भाद्रपद", "उत्तर भाद्रपद", "रेवती",
];

/** English nakshatra name → Devanagari (same order as NAKSHATRAS in types.ts). */
const NAKSHATRA_EN_TO_HI: Record<string, string> = Object.fromEntries(
  NAKSHATRAS.map((name, i) => [name, NAKSHATRA_HI[i]])
);

export function nakshatraName(name: string, locale: EngineLocale): string {
  return locale === "hi" ? NAKSHATRA_EN_TO_HI[name] ?? name : name;
}

// ------------------------------------------------------------------ tithi (14 + 2)

export const TITHI_HI: Record<string, string> = {
  Pratipada: "प्रतिपदा",
  Dwitiya: "द्वितीया",
  Tritiya: "तृतीया",
  Chaturthi: "चतुर्थी",
  Panchami: "पंचमी",
  Shashthi: "षष्ठी",
  Saptami: "सप्तमी",
  Ashtami: "अष्टमी",
  Navami: "नवमी",
  Dashami: "दशमी",
  Ekadashi: "एकादशी",
  Dwadashi: "द्वादशी",
  Trayodashi: "त्रयोदशी",
  Chaturdashi: "चतुर्दशी",
  Purnima: "पूर्णिमा",
  Amavasya: "अमावस्या",
  Shukla: "शुक्ल",
  Krishna: "कृष्ण",
};

export function tithiName(name: string, locale: EngineLocale): string {
  if (locale !== "hi") return name;
  // "Shukla Chaturdashi" → "शुक्ल चतुर्दशी"
  return name
    .split(" ")
    .map((part) => TITHI_HI[part] ?? part)
    .join(" ");
}

// ------------------------------------------------------------------ yoga (27)

export const YOGA_HI: Record<string, string> = {
  Vishkambha: "विष्कम्भ",
  Priti: "प्रीति",
  Ayushman: "आयुष्मान्",
  Saubhagya: "सौभाग्य",
  Shobhana: "शोभन",
  Atiganda: "अतिगंड",
  Sukarma: "सुकर्मा",
  Dhriti: "धृति",
  Shula: "शूल",
  Ganda: "गंड",
  Vriddhi: "वृद्धि",
  Dhruva: "ध्रुव",
  Vyaghata: "व्याघात",
  Harshana: "हर्षण",
  Vajra: "वज्र",
  Siddhi: "सिद्धि",
  Vyatipata: "व्यतिपात",
  Variyana: "वरीयान",
  Parigha: "परिघ",
  Shiva: "शिव",
  Siddha: "सिद्ध",
  Sadhya: "साध्य",
  Shubha: "शुभ",
  Shukla: "शुक्ल",
  Brahma: "ब्रह्मा",
  Indra: "इंद्र",
  Vaidhriti: "वैधृति",
};

// ------------------------------------------------------------------ karana (7 movable + 3 fixed + 1 first)

export const KARANA_HI: Record<string, string> = {
  Bava: "बव",
  Balava: "बालव",
  Kaulava: "कौलव",
  Taitila: "तैतिल",
  Gara: "गर",
  Vanija: "वणिज",
  Vishti: "विष्टि",
  Shakuni: "शकुनि",
  Chatushpada: "चतुष्पद",
  Naga: "नाग",
  Kimstughna: "किंस्तुघ्न",
};

// ------------------------------------------------------------------ vara (weekdays)

export const VARA_HI: Record<string, string> = {
  Sunday: "रविवार",
  Monday: "सोमवार",
  Tuesday: "मंगलवार",
  Wednesday: "बुधवार",
  Thursday: "गुरुवार",
  Friday: "शुक्रवार",
  Saturday: "शनिवार",
};

// ------------------------------------------------------------------ choghadiya (7)

export const CHOGHADIYA_HI: Record<ChoghadiyaName, string> = {
  Udveg: "उद्वेग",
  Chal: "चल",
  Labh: "लाभ",
  Amrit: "अमृत",
  Kaag: "काग",
  Shubh: "शुभ",
  Rog: "रोग",
};

export function choghadiyaName(name: ChoghadiyaName, locale: EngineLocale): string {
  return locale === "hi" ? CHOGHADIYA_HI[name] : name;
}

// ------------------------------------------------------------------ lord meanings

export const LORD_MEANING_HI: Record<PlanetName, string> = {
  Sun: "पहचान, आत्मविश्वास और दृश्यता",
  Moon: "भावनाएँ, घर और जुड़ाव",
  Mars: "ऊर्जा, साहस और सीधी कार्रवाई",
  Mercury: "सीखना, संवाद और व्यापार",
  Jupiter: "वृद्धि, मार्गदर्शन और विस्तार",
  Venus: "सुख, रिश्ते और सौंदर्य",
  Saturn: "अनुशासन, धैर्य और दीर्घकालिक परिश्रम",
  Rahu: "महत्वाकांक्षा, नई दिशाएँ और परिचित से आगे की वृद्धि",
  Ketu: "चिंतन, वैराग्य और भीतरी स्पष्टता",
};

// ------------------------------------------------------------------ house themes

export const HOUSE_THEMES_HI: Record<number, string> = {
  1: "स्वयं, शरीर, आपकी उपस्थिति",
  2: "धन, भोजन, परिवार, वाणी",
  3: "प्रयास, भाई-बहन, संवाद, साहस",
  4: "घर, माता, मानसिक शांति, संपत्ति",
  5: "रचनात्मकता, संतान, अध्ययन, प्रेम",
  6: "कार्य, स्वास्थ्य, दिनचर्या, सेवा",
  7: "साझेदारी, विवाह, अनुबंध",
  8: "गहराई, परिवर्तन, साझा संसाधन",
  9: "भाग्य, गुरु, यात्राएँ, मान्यताएँ",
  10: "करियर, प्रतिष्ठा, उत्तरदायित्व",
  11: "समाज, लाभ, मित्रताएँ",
  12: "विश्राम, त्याग, विदेश, एकांत",
};
