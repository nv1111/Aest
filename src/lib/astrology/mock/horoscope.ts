/**
 * MOCK ENGINE — deterministic horoscope readings per (moonSign, period, date).
 * Text is template-based, seeded, calm and non-predictive in tone.
 */

import type { HoroscopePeriod, HoroscopeReading, SignName } from "../types";
import { hashString, mulberry32 } from "./positions";
import { signName } from "../names";

const HEADLINES: Record<HoroscopePeriod, string[]> = {
  daily: [
    "A steady, grounded day",
    "Small conversations carry weight today",
    "Momentum builds quietly",
    "A day for one clear priority",
    "Patience pays today",
  ],
  weekly: [
    "A week of two halves",
    "Slow start, strong finish",
    "Connections come forward",
    "Consistency is your theme",
    "A week to consolidate",
  ],
  monthly: [
    "Foundations and forward motion",
    "A month of steady tides",
    "Clarity arrives mid-month",
    "Growth below the surface",
    "A month to commit to one thing",
  ],
  yearly: [
    "A year of building",
    "Roots deepen, then branches spread",
    "Patient expansion",
    "A turning year in slow motion",
    "Discipline becomes freedom",
  ],
};

const HEADLINES_HI: Record<HoroscopePeriod, string[]> = {
  daily: [
    "स्थिर, ज़मीन से जुड़ा दिन",
    "आज छोटी बातचीत में गहराई है",
    "गति चुपचाप बनती है",
    "एक स्पष्ट प्राथमिकता का दिन",
    "धैर्य आज रंग लाता है",
  ],
  weekly: [
    "दो हिस्सों का सप्ताह",
    "धीरी शुरुआत, मज़बूत अंत",
    "रिश्ते आगे आते हैं",
    "निरंतरता आपकी थीम है",
    "समेकन का सप्ताह",
  ],
  monthly: [
    "नींव और आगे की गति",
    "स्थिर लहरों का महीना",
    "स्पष्टता महीने के बीच आती है",
    "वृद्धि सतह के नीचे",
    "एक काम के प्रति प्रतिबद्धता का महीना",
  ],
  yearly: [
    "निर्माण का वर्ष",
    "जड़ें गहरी होती हैं, फिर शाखाएँ फैलती हैं",
    "धैर्यपूर्ण विस्तार",
    "धीमी गति से बदलाव का वर्ष",
    "अनुशासन ही स्वतंत्रता बनता है",
  ],
};

const SECTIONS: { title: string; bodies: string[] }[] = [
  {
    title: "Career & work",
    bodies: [
      "Work moves at an even pace. Traditional astrology reads your Moon's energy right now as favourable for finishing rather than starting — close loops before opening new ones.",
      "A colleague or senior may hand you a small responsibility that grows later. Take it seriously without over-promising; steady delivery builds your case this period.",
      "Avoid office politics this period; your strength is in dependable output. If you've been considering a skill upgrade, the signs support study.",
      "Money follows patience now. Roles that felt stuck begin to move once you stop forcing outcomes and let results speak.",
    ],
  },
  {
    title: "Relationships",
    bodies: [
      "Listen more than you speak in close relationships this period. The Moon's reading suggests people around you need to feel heard before they can support you.",
      "A light misunderstanding is possible mid-period — address it early and simply. Warmth returns quickly when you take the first step.",
      "Family matters benefit from small rituals: a shared meal, a short call. Consistency matters more than grand gestures.",
      "If single, this is a period of observation rather than pursuit. If committed, plan something small and concrete together.",
    ],
  },
  {
    title: "Wellbeing",
    bodies: [
      "Your energy is steady but not infinite. Guard sleep — the Moon's current reading makes rest unusually restorative this period.",
      "Movement helps more than intensity: walks, stretching, rhythm. Digestion may be sensitive during transitions; eat warm and simple.",
      "A calm mind is your real asset now. Ten minutes of quiet in the morning changes the shape of the day.",
      "Watch for ignored small symptoms — this period favours prevention over cure.",
    ],
  },
  {
    title: "Money",
    bodies: [
      "Steady inflow, occasional temptation. Traditional readings suggest waiting a day before any unplanned purchase.",
      "A good period to review subscriptions, dues and small leaks — the chart favours tidying over expanding.",
      "Avoid lending or borrowing large amounts this period if you can; clarity in written agreements protects everyone.",
      "Long-term saving habits formed now tend to stick, the reading suggests. Automate what you can.",
    ],
  },
];

const SECTIONS_HI: { title: string; bodies: string[] }[] = [
  {
    title: "करियर और कार्य",
    bodies: [
      "कार्य समान गति से चल रहा है। परंपरागत ज्योतिष आपकी चंद्र-ऊर्जा को अभी शुरू करने की बजाय पूरा करने के लिए अनुकूल मानता है — नया शुरू करने से पहले पुराने चल रहे काम बंद करें।",
      "कोई सहकर्मी या वरिष्ठ आपको एक छोटी ज़िम्मेदारी दे सकते हैं जो आगे बढ़ती है। इसे गंभीरता से लें, अति-वादे न करें; स्थिर डिलिवरी आपकी पक्ष रखती है।",
      "इस दौर में दफ़्तर की राजनीति से दूर रहें; आपकी ताक़त भरोसेमंद काम में है। यदि कौशल-सुधार सोच रहे हैं, तो ग्रह अध्ययन के पक्ष में हैं।",
      "पैसा अब धैर्य के पीछे चलता है। जो भूमिकाएँ अटकी लग रही थीं, वे खुद को थोपना बंद करते ही चलने लगेंगी।",
    ],
  },
  {
    title: "रिश्ते",
    bodies: [
      "इस दौर में करीबी रिश्तों में बोलने से ज़्यादा सुनें। चंद्र की स्थिति बताती है कि आपके आस-पास के लोग सहयोग करने से पहले सुना जाना चाहते हैं।",
      "दौर के बीच एक हल्की गलतफ़हमी संभव है — उसे जल्दी और सरलता से सुलझाएँ। आप पहला कदम उठाते हैं तो गर्मजोशी जल्दी लौटती है।",
      "घरेलू मामलों में छोटी अनुष्ठान कारगर हैं: साथ भोजन, एक छोटा फ़ोन। भव्य इशारों से ज़्यादा निरंतरता मायने रखती है।",
      "यदि आपका रिश्ता नहीं है, तो यह अनुसरण नहीं, अवलोकन का दौर है। यदि साथ हैं, तो साथ कुछ छोटा और ठोस योजना बनाएँ।",
    ],
  },
  {
    title: "स्वास्थ्य",
    bodies: [
      "आपकी ऊर्जा स्थिर है, अनंत नहीं। नींद की रक्षा करें — चंद्र की वर्तमान स्थिति में विश्राम असामान्य रूप से चंगाई करता है।",
      "तीव्रता से ज़्यादा हलचल कारगर है: सैर, स्ट्रेचिंग, लय। बदलाव के दौर में पाचन संवेदनशील रह सकता है; गर्म और सरल भोजन करें।",
      "शांत मन अभी आपकी असली पूँजी है। सुबह के दस मिनट की ख़ामोशी दिन का आकार बदल देती है।",
      "नज़रअंदाज़ किए छोटे लक्षणों पर ध्यान दें — यह दौर इलाज से पहले बचाव के पक्ष में है।",
    ],
  },
  {
    title: "धन",
    bodies: [
      "आमदनी स्थिर, लालसा कभी-कभी। परंपरागत पाठ योजना-रहित ख़रीद से पहले एक दिन रुकने का सुझाव देता है।",
      "सदस्यताएँ, बकाया और छोटे रिसाव देखने का अच्छा दौर है — विस्तार से ज़्यादा सफ़ाई के पक्ष में रहें।",
      "संभव हो तो इस दौर में बड़ी रक़म उधार देने या लेने से बचें; लिखित स्पष्टता सबकी रक्षा करती है।",
      "अब बनी दीर्घकालिक बचत की आदतें टिकती हैं। जो संभव हो, स्वचालित कर दें।",
    ],
  },
];

const SUMMARIES: Record<HoroscopePeriod, string[]> = {
  daily: [
    "An unhurried day where small things land well. Focus on one thing at a time and let the rest wait.",
    "People around you are more receptive than usual — a good day to ask, propose or reconnect.",
    "Energy dips early, then steadies. Don't judge the day by its first hour.",
    "Practical matters flow; creative ones need a nudge. Handle the practical first.",
    "A quiet day with one meaningful moment. Keep room for it.",
  ],
  weekly: [
    "The week rewards preparation over speed. Set your priorities by mid-week and the rest follows.",
    "Relationships and responsibilities ask for balance. Small consistent gestures beat big ones.",
    "A busy start gives way to clarity. By the weekend, you'll know what matters.",
    "Progress is quieter than it feels. Trust the process and keep records of what you finish.",
  ],
  monthly: [
    "A month of quiet compounding. What you maintain this month becomes your platform next month.",
    "Momentum shifts around the second half — hold your routines through the slow first weeks.",
    "Decisions delayed earlier finally ripen. Move once, move clearly.",
    "People and money both need patience this month. Plans made calmly stick.",
  ],
  yearly: [
    "A year where discipline in the first half becomes freedom in the second. Build routines you can keep.",
    "Growth is real but gradual — you'll notice it most in hindsight. Document the journey.",
    "Relationships deepen through consistency. Career advances through specialisation.",
    "A year to simplify. Every commitment you cut makes the remaining ones stronger.",
  ],
};

const SUMMARIES_HI: Record<HoroscopePeriod, string[]> = {
  daily: [
    "एक अनहड़ दिन जिसमें छोटी चीज़ें अच्छी बैठती हैं। एक समय में एक काम करें, बाक़ी को इंतज़ार करने दें।",
    "आपके आस-पास के लोग आम से ज़्यादा ग्रहणशील हैं — पूछने, प्रस्ताव रखने या दोबारा जुड़ने का अच्छा दिन।",
    "ऊर्जा शुरू में गिरती है, फिर संभलती है। दिन को पहले घंटे से नापें नहीं।",
    "व्यावहारिक मामले बनते हैं; रचनात्मक मामलों को धक्का चाहिए। पहले व्यावहारिक निपटाएँ।",
    "शांत दिन, एक अर्थपूर्ण पल के साथ। उसके लिए जगह रखें।",
  ],
  weekly: [
    "सप्ताह गति से ज़्यादा तैयारी का इनाम देता है। हफ़्ते के बीच तक प्राथमिकताएँ तय करें, बाक़ी अपने आप बनेगा।",
    "रिश्ते और ज़िम्मेदारियाँ संतुलन माँगते हैं। बड़े इशारों से छोटे, लगातार इशारे बेहतर हैं।",
    "व्यस्त शुरुआत स्पष्टता में बदलती है। सप्ताहांत तक आप जान जाएँगे कि क्या मायने रखता है।",
    "प्रगति जितनी दिखती है, उससे शांत है। प्रक्रिया पर भरोसा रखें और जो पूरा हो रहा है उसका लेखा रखें।",
  ],
  monthly: [
    "शांत संचय का महीना। इस महीने जो आप बनाए रखेंगे, वही अगले महीने का मंच बनेगा।",
    "गति दूसरे आधे में बदलती है — पहले सप्ताहों की धीमापन में अपनी दिनचर्या बनाए रखें।",
    "पहले टाले गए निर्णय अब पकते हैं। एक बार चलें, साफ़ चलें।",
    "इस महीने लोग भी और पैसा भी धैर्य माँगता है। शांति से बनी योजनाएँ टिकती हैं।",
  ],
  yearly: [
    "ऐसा वर्ष जिसमें पहले आधे का अनुशासन दूसरे आधे की स्वतंत्रता बनता है। ऐसी दिनचर्या बनाएँ जो निभ सके।",
    "वृद्धि असली है पर क्रमिक — आपको वह पीछे मुड़कर सबसे ज़्यादा दिखेगी। यात्रा दर्ज करते जाएँ।",
    "रिश्ते निरंतरता से गहरे होते हैं। करियर विशेषज्ञता से आगे बढ़ता है।",
    "सरल बनाने का वर्ष। जो प्रतिबद्धता आप काटेंगे, वह बाक़ी सबको मज़बूत करेगी।",
  ],
};

const ENERGY: string[] = ["Low", "Steady", "Building", "High", "Peak"];
const ENERGY_HI: string[] = ["कम", "स्थिर", "बढ़ती", "उच्च", "शिखर"];

export function energyLabel(rating: number, locale: "en" | "hi" = "en"): string {
  const list = locale === "hi" ? ENERGY_HI : ENERGY;
  return list[Math.min(4, Math.max(0, rating - 1))];
}

export function buildHoroscope(
  moonSign: SignName,
  moonSignIndex: number,
  period: HoroscopePeriod,
  asOf: Date,
  provider: HoroscopeReading["provider"],
  locale: "en" | "hi" = "en"
): HoroscopeReading {
  const intlLocale = locale === "hi" ? "hi-IN" : "en-IN";
  const dateLabel =
    period === "daily"
      ? new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", year: "numeric" }).format(asOf)
      : period === "weekly"
        ? locale === "hi"
          ? `${new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(asOf)} से सप्ताह`
          : `Week of ${new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(asOf)}`
        : period === "monthly"
          ? new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(asOf)
          : String(asOf.getFullYear());

  const key = `${period}|${moonSign}|${period === "daily" ? asOf.toISOString().slice(0, 10) : period === "weekly" ? String(getISOWeek(asOf)) : period === "monthly" ? asOf.toISOString().slice(0, 7) : asOf.getFullYear()}`;
  const rng = mulberry32(hashString(key));

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const isHi = locale === "hi";
  const headlinePool = isHi ? HEADLINES_HI[period] : HEADLINES[period];
  const summariesPool = isHi ? SUMMARIES_HI[period] : SUMMARIES[period];
  const sectionsPool = isHi ? SECTIONS_HI : SECTIONS;

  return {
    provider,
    period,
    basis: isHi
      ? `यह पाठ आपकी चंद्र राशि (${signName(moonSign, locale)}) पर आधारित है। यह सामान्य मार्गदर्शन है जो आपकी कुंडली के संदर्भ से आकार लेता है — कोई स्थिर भविष्यवाणी नहीं।`
      : `This reading is based on your Moon sign (${moonSign}). It is general guidance shaped by your chart context — not a fixed prediction.`,
    moonSign,
    dateLabel,
    headline: pick(headlinePool),
    summary: pick(summariesPool),
    sections: sectionsPool.map((s) => ({ title: s.title, body: pick(s.bodies) })),
    rating: 2 + Math.floor(rng() * 3), // 2–4
  };
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
