/**
 * LiveAstrologyProvider — the REAL engine.
 *
 * Planetary math: astronomy-engine (VSOP87-grade) via ./ephemeris.
 * Interpretation/content builders are shared with the mock engine
 * (buildDasha / buildPanchang / buildCompatibility / buildHoroscope) — the
 * structure was always traditional; only the input positions were demo.
 * Feeding real ephemeris longitudes makes every output real.
 */

import {
  DASHA_ORDER,
  HOUSE_THEMES,
  NAKSHATRAS,
  PLANETS,
  SIGNS,
  SIGN_LORDS,
  SIGN_SANSKRIT,
  nakshatraLord,
  type AstrologyInput,
  type AstrologyProvider,
  type BirthChart,
  type DivisionalChart,
  type HomeAstrology,
  type HoroscopePeriod,
  type PlanetPosition,
  type ProviderInfo,
  type SignName,
  type TransitEntry,
  type TransitInfo,
} from "../types";
import {
  ascendantLongitude,
  dailyMotion,
  isRetrograde,
  houseFromSign,
  localToUTC,
  lunarEvents,
  norm360,
  siderealLongitude,
  signEntryTimes,
  solarEvents,
  toLocalHHMM,
  hhmmToMinutes,
} from "./ephemeris";
import { buildDasha, lordMeaning } from "../mock/dasha";
import { buildPanchang, currentChoghadiya, type PanchangPositions } from "../mock/panchang";
import { buildCompatibility } from "../mock/compatibility";
import { buildHoroscope } from "../mock/horoscope";
import {
  HOUSE_THEMES_HI,
  LORD_MEANING_HI,
  nakshatraName,
  planetName,
  signName,
  type EngineLocale,
} from "../names";

export const LIVE_PROVIDER_INFO: ProviderInfo = {
  id: "live-engine-v1",
  mode: "live",
  label: "Tara ephemeris engine",
  disclaimer:
    "Positions calculated from real ephemeris data (VSOP87-grade planetary theory, Lahiri ayanamsa). Interpretations follow traditional Vedic practice and are guidance, not prediction.",
};

/** Real-ephemeris position source injected into the shared panchang builder. */
const livePositions: PanchangPositions = {
  moonLongitude: (d) => siderealLongitude("Moon", d),
  sunLongitude: (d) => siderealLongitude("Sun", d),
  solarEvents,
  lunarEvents,
};

// ---------------------------------------------------------------- divisional

/** D9 Navamsa sign: universal rule (signIndex*9 + navamsa-number) % 12. */
function navamsaSign(longitude: number): SignName {
  const signIndex = Math.floor(longitude / 30);
  const n9 = Math.floor((longitude % 30) / (10 / 3));
  return SIGNS[(signIndex * 9 + n9) % 12];
}

/** D10 Dashamsa sign: odd signs count from themselves, even from the 9th. */
function dashamsaSign(longitude: number): SignName {
  const signIndex = Math.floor(longitude / 30);
  const n10 = Math.floor((longitude % 30) / 3);
  const start = signIndex % 2 === 0 ? signIndex : (signIndex + 8) % 12;
  return SIGNS[(start + n10) % 12];
}

// ---------------------------------------------------------------- transit text

const PLANET_NATURE: Record<string, string> = {
  Sun: "confidence and visibility",
  Moon: "emotions and home life",
  Mars: "energy and drive",
  Mercury: "communication and learning",
  Jupiter: "growth and opportunity",
  Venus: "relationships and comfort",
  Saturn: "structure and responsibility",
  Rahu: "ambition and restlessness",
  Ketu: "reflection and detachment",
};

const PLANET_NATURE_HI: Record<string, string> = {
  Sun: "आत्मविश्वास और दृश्यता",
  Moon: "भावनाएँ और घरेलू जीवन",
  Mars: "ऊर्जा और जोश",
  Mercury: "संवाद और अध्ययन",
  Jupiter: "वृद्धि और अवसर",
  Venus: "रिश्ते और सुख",
  Saturn: "अनुशासन और उत्तरदायित्व",
  Rahu: "महत्वाकांक्षा और बेचैनी",
  Ketu: "चिंतन और वैराग्य",
};

function transitInterpretation(planet: string, house: number, locale: EngineLocale): string {
  if (locale === "hi") {
    const p = planetName(planet as never, locale);
    const theme = HOUSE_THEMES_HI[house];
    if (planet === "Saturn" || planet === "Rahu" || planet === "Ketu") {
      return `${p} इस समय आपके ${house}वें भाव से गुज़र रहा है — ${theme}। परंपरागत ज्योतिष धीमे चलने वाले ${p} को इस भाव में ${theme} से जुड़ा धैर्य माँगने वाला समय मानता है; यहाँ अर्जित फल टिकाऊ होता है।`;
    }
    return `${p} इस समय आपके ${house}वें भाव से गुज़र रहा है — ${theme}। परंपरागत ज्योतिष इस दौर में जीवन के इस क्षेत्र पर ${PLANET_NATURE_HI[planet]} का बढ़ा प्रभाव मानता है।`;
  }
  const nature = PLANET_NATURE[planet];
  const theme = HOUSE_THEMES[house].toLowerCase();
  if (planet === "Saturn" || planet === "Rahu" || planet === "Ketu") {
    return `${planet} currently moves through your ${house}th house — ${theme}. Traditional astrology reads slow-moving ${planet} here as a period that asks for patience around ${theme}; results are lasting once earned.`;
  }
  return `${planet} currently moves through your ${house}th house — ${theme}. Traditional astrology connects transiting ${planet} with heightened ${nature} in this area of life for the duration.`;
}

// ---------------------------------------------------------------- provider

export class LiveAstrologyProvider implements AstrologyProvider {
  readonly info = LIVE_PROVIDER_INFO;

  getBirthChart(input: AstrologyInput, locale: "en" | "hi" = "en"): BirthChart {
    const birthUTC = localToUTC(input.dateOfBirth, input.timeOfBirth, input.timezone);

    // Ascendant — real oblique-sphere formula. Unknown time → solar-noon chart,
    // clearly flagged as approximate (no random spread; deterministic).
    const timeKnown = input.timeAccuracy !== "unknown" && input.timeOfBirth;
    const ascDate = timeKnown ? birthUTC : localToUTC(input.dateOfBirth, "12:00", input.timezone);
    const ascLong = ascendantLongitude(ascDate, input.latitude, input.longitude);
    const ascSignIndex = Math.floor(ascLong / 30);

    // Planets — real ephemeris
    const planets: PlanetPosition[] = PLANETS.map((planet) => {
      const longitude = siderealLongitude(planet, birthUTC);
      const signIndex = Math.floor(longitude / 30);
      const nakIndex = Math.floor(longitude / (360 / 27));
      const pada = (Math.floor((longitude % (360 / 27)) / (360 / 108)) + 1) as 1 | 2 | 3 | 4;
      return {
        planet,
        longitude: Math.round(longitude * 100) / 100,
        sign: SIGNS[signIndex],
        signIndex,
        degreeInSign: Math.round((longitude % 30) * 100) / 100,
        house: houseFromSign(signIndex, ascSignIndex),
        nakshatra: NAKSHATRAS[nakIndex],
        nakshatraPada: pada,
        nakshatraLord: nakshatraLord(nakIndex),
        signLord: SIGN_LORDS[SIGNS[signIndex]],
        isRetrograde: isRetrograde(planet, birthUTC),
      };
    });

    const moon = planets.find((p) => p.planet === "Moon")!;
    const sun = planets.find((p) => p.planet === "Sun")!;

    // Houses (whole-sign Parashari)
    const houses = SIGNS.map((sign, i) => {
      const house = houseFromSign(i, ascSignIndex);
      return {
        house,
        sign,
        signIndex: i,
        signLord: SIGN_LORDS[sign],
        planets: planets.filter((p) => p.signIndex === i).map((p) => p.planet),
        theme: locale === "hi" ? HOUSE_THEMES_HI[house] : HOUSE_THEMES[house],
      };
    }).sort((a, b) => a.house - b.house);

    // Divisional charts — D1, D9 (real rules), D10
    const d1Houses = SIGNS.map((_, i) => ({
      house: houseFromSign(i, ascSignIndex),
      sign: SIGNS[i],
      planets: planets.filter((p) => p.signIndex === i).map((p) => p.planet),
    })).sort((a, b) => a.house - b.house);

    const mkDivisional = (
      ascFn: (lon: number) => SignName,
      planetFn: (lon: number) => SignName
    ) => {
      const ascSign = ascFn(ascLong);
      const ascIdx = SIGNS.indexOf(ascSign);
      const placed = planets.map((p) => ({ planet: p.planet, sign: planetFn(p.longitude) }));
      return SIGNS.map((_, i) => ({
        house: houseFromSign(i, ascIdx),
        sign: SIGNS[i] as SignName,
        planets: placed.filter((p) => SIGNS.indexOf(p.sign) === i).map((p) => p.planet),
      })).sort((a, b) => a.house - b.house);
    };

    const d9Houses = mkDivisional(navamsaSign, navamsaSign);
    const d10Houses = mkDivisional(dashamsaSign, dashamsaSign);

    const divisional: DivisionalChart[] =
      locale === "hi"
        ? [
            { id: "D1", name: "राशि (D1)", description: "मुख्य जन्म कुंडली — आपकी मूल रूपरेखा।", houses: d1Houses },
            { id: "D9", name: "नवांश (D9)", description: "'फल' कुंडली — परंपरा में विवाह, भीतरी बल और उत्तरार्ध जीवन के लिए देखी जाती है।", houses: d9Houses },
            { id: "D10", name: "दशांश (D10)", description: "'कर्म' कुंडली — परंपरा में जीविका, पेशा और सार्वजनिक जीवन के लिए देखी जाती है।", houses: d10Houses },
          ]
        : [
            { id: "D1", name: "Rashi (D1)", description: "The main birth chart — your core blueprint.", houses: d1Houses },
            { id: "D9", name: "Navamsa (D9)", description: "The 'fruit' chart — traditionally read for marriage, inner strength and later life.", houses: d9Houses },
            { id: "D10", name: "Dashamsa (D10)", description: "The 'career' chart — traditionally read for livelihood, profession and public life.", houses: d10Houses },
          ];

    // Key highlights in plain language
    const ascLord = SIGN_LORDS[SIGNS[ascSignIndex]];
    const keyHighlights =
      locale === "hi"
        ? [
            {
              title: `आपकी चंद्र राशि ${signName(moon.sign, locale)} है`,
              body: `वैदिक ज्योतिष में चंद्र राशि (${signName(moon.sign, locale)}) आपका भावनात्मक आधार है — आप कैसे दिखते हैं उससे ज़्यादा, आप कैसे महसूस करते और प्रतिक्रिया देते हैं। चंद्र ${nakshatraName(moon.nakshatra, locale)} नक्षत्र में हैं, पद ${moon.nakshatraPada}।`,
            },
            {
              title: `आपका लग्न ${signName(SIGNS[ascSignIndex], locale)} है`,
              body: `लग्न आपके जन्म के क्षण पूर्वी क्षितिज पर उदित होने वाली राशि है — यह जीवन के प्रति आपके समग्र दृष्टिकोण को आकार देती है। इसके स्वामी ${planetName(ascLord, locale)} हैं, जो ${LORD_MEANING_HI[ascLord]} से जुड़े हैं।`,
            },
            {
              title: `सूर्य ${signName(sun.sign, locale)} में`,
              body: `सूर्य की राशि आपके उद्देश्य और पहचान का संकेत देती है। ${signName(sun.sign, locale)} में उद्देश्य इसी राशि के गुणों के ज़रिए व्यक्त होता है।`,
            },
            {
              title: `${nakshatraName(moon.nakshatra, locale)} नक्षत्र`,
              body: `चंद्र का नक्षत्र (जन्म-तारा) ${nakshatraName(moon.nakshatra, locale)} है, जिसके स्वामी ${planetName(moon.nakshatraLord, locale)} हैं। यही आपकी विंशोत्तरी दशा का क्रम तय करता है — जीवन के ग्रह-दौर।`,
            },
          ]
        : [
            {
              title: `Your Moon sign is ${moon.sign}`,
              body: `In Vedic astrology the Moon sign (${SIGN_SANSKRIT[moon.sign]}) is your emotional core — how you feel and respond, more than how you appear. The Moon sits in ${moon.nakshatra}, pada ${moon.nakshatraPada}.`,
            },
            {
              title: `Your ascendant is ${SIGNS[ascSignIndex]}`,
              body: `The ascendant (Lagna) is the sign rising on the eastern horizon at your birth — it shapes your overall approach to life. Its lord is ${ascLord}, linked to ${lordMeaning(ascLord)}.`,
            },
            {
              title: `Your Sun is in ${sun.sign}`,
              body: `The Sun's sign describes your sense of purpose and identity. In ${sun.sign}, purpose is expressed through the qualities of this sign.`,
            },
            {
              title: `${moon.nakshatra} nakshatra`,
              body: `The Moon's nakshatra (birth star) is ${moon.nakshatra}, ruled by ${moon.nakshatraLord}. It sets your Vimshottari dasha sequence — the planetary phases of your life.`,
            },
          ];

    const note =
      locale === "hi"
        ? input.timeAccuracy === "unknown"
          ? "जन्म समय अज्ञात है, इसलिए लग्न दोपहर के संदर्भ से निकाला गया है और अनुमानित है। सटीक कुंडली के लिए बाद में अपना पक्का समय जोड़ें।"
          : input.timeAccuracy === "approximate"
            ? "जन्म समय लगभग बताया गया है, इसलिए लग्न-भाव थोड़े बदल सकते हैं।"
            : "कुंडली आपके सटीक जन्म समय से, वास्तविक इफ़ेमरिस गणना से बनाई गई है।"
        : input.timeAccuracy === "unknown"
          ? "Birth time is unknown, so the ascendant is derived from a noon reference and is approximate. Add your exact time later for an accurate chart."
          : input.timeAccuracy === "approximate"
            ? "Birth time is approximate, so the ascendant and houses may shift slightly."
            : "Chart calculated from your exact birth time using real ephemeris data.";

    return {
      provider: this.info,
      input,
      ascendant: {
        sign: SIGNS[ascSignIndex],
        signIndex: ascSignIndex,
        degreeInSign: Math.round((ascLong % 30) * 100) / 100,
        lord: SIGN_LORDS[SIGNS[ascSignIndex]],
        isApproximate: input.timeAccuracy !== "exact",
      },
      moonSign: { sign: moon.sign, signIndex: moon.signIndex, sanskrit: SIGN_SANSKRIT[moon.sign] },
      sunSign: { sign: sun.sign, sanskrit: SIGN_SANSKRIT[sun.sign] },
      nakshatra: { name: moon.nakshatra, pada: moon.nakshatraPada, lord: moon.nakshatraLord },
      planets,
      houses,
      divisional,
      keyHighlights,
      note,
    };
  }

  getDasha(
    input: AstrologyInput,
    asOf = new Date(),
    locale: "en" | "hi" = "en"
  ): ReturnType<AstrologyProvider["getDasha"]> {
    const birthUTC = localToUTC(input.dateOfBirth, input.timeOfBirth, input.timezone);
    const moonLong = siderealLongitude("Moon", birthUTC);
    return buildDasha(moonLong, birthUTC.getTime(), asOf, this.info, locale);
  }

  getTransit(input: AstrologyInput, asOf = new Date(), locale: "en" | "hi" = "en"): TransitInfo {
    const birthUTC = localToUTC(input.dateOfBirth, input.timeOfBirth, input.timezone);
    const timeKnown = input.timeAccuracy !== "unknown" && input.timeOfBirth;
    const ascDate = timeKnown ? birthUTC : localToUTC(input.dateOfBirth, "12:00", input.timezone);
    const ascLong = ascendantLongitude(ascDate, input.latitude, input.longitude);
    const ascSignIndex = Math.floor(ascLong / 30);

    const transits: TransitEntry[] = PLANETS.map((planet) => {
      const longitude = siderealLongitude(planet, asOf);
      const signIndex = Math.floor(longitude / 30);
      // real boundary crossings (handles retrograde re-entry naturally)
      const { enteredOn, leavesOn } = signEntryTimes(planet, asOf);
      const natalHouse = houseFromSign(signIndex, ascSignIndex);
      return {
        planet,
        currentSign: SIGNS[signIndex],
        currentSignIndex: signIndex,
        natalHouse,
        startedOn: enteredOn.toISOString(),
        endsOn: leavesOn.toISOString(),
        isRetrograde: isRetrograde(planet, asOf),
        interpretation: transitInterpretation(planet, natalHouse, locale),
      };
    });

    const slow = transits.filter((t) => ["Saturn", "Jupiter", "Rahu", "Ketu"].includes(t.planet));
    const notable = slow.map((t) =>
      locale === "hi"
        ? `${planetName(t.planet, locale)} ${signName(t.currentSign, locale)} में हैं और आपके ${t.natalHouse}वें भाव से गुज़र रहे हैं।`
        : `${t.planet} is in ${t.currentSign}, transiting your ${t.natalHouse}th house`
    );

    return { provider: this.info, asOf: asOf.toISOString(), transits, notable };
  }

  getPanchang(
    date: string,
    location: { name: string; latitude: number; longitude: number; timezone: string },
    locale: "en" | "hi" = "en"
  ) {
    return buildPanchang(date, location, this.info, locale, livePositions);
  }

  getHoroscope(
    input: AstrologyInput,
    period: HoroscopePeriod,
    asOf = new Date(),
    locale: "en" | "hi" = "en"
  ) {
    const birthUTC = localToUTC(input.dateOfBirth, input.timeOfBirth, input.timezone);
    const moonLong = siderealLongitude("Moon", birthUTC);
    const moonSignIndex = Math.floor(moonLong / 30);
    return buildHoroscope(SIGNS[moonSignIndex], moonSignIndex, period, asOf, this.info, locale);
  }

  getCompatibility(
    a: { id: string; input: AstrologyInput },
    b: { id: string; input: AstrologyInput },
    locale: "en" | "hi" = "en"
  ) {
    const extract = ({ id, input }: { id: string; input: AstrologyInput }) => {
      const birthUTC = localToUTC(input.dateOfBirth, input.timeOfBirth, input.timezone);
      const moonLongitude = siderealLongitude("Moon", birthUTC);
      const marsLongitude = siderealLongitude("Mars", birthUTC);
      const timeKnown = input.timeAccuracy !== "unknown" && input.timeOfBirth;
      const ascDate = timeKnown ? birthUTC : localToUTC(input.dateOfBirth, "12:00", input.timezone);
      const ascLong = ascendantLongitude(ascDate, input.latitude, input.longitude);
      return {
        id,
        name: input.name,
        moonLongitude,
        ascSignIndex: Math.floor(ascLong / 30),
        marsSignIndex: Math.floor(marsLongitude / 30),
        marsHouseFromMoon: houseFromSign(Math.floor(marsLongitude / 30), Math.floor(moonLongitude / 30)),
      };
    };
    return buildCompatibility(extract(a), extract(b), this.info, locale);
  }

  getHomeAstrology(input: AstrologyInput, asOf = new Date(), locale: "en" | "hi" = "en"): HomeAstrology {
    const dasha = this.getDasha(input, asOf, locale);
    const panchang = this.getPanchang(
      asOf.toISOString().slice(0, 10),
      {
        name: input.placeName,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: input.timezone,
      },
      locale
    );

    // Day insight grounded in the real Moon transit: distance travelled today
    // + nakshatra lord + dasha context.
    const moonNow = siderealLongitude("Moon", asOf);
    const nakIndex = Math.floor(moonNow / (360 / 27));
    const mahaLord = planetName(dasha.current.mahadasha.lord, locale);
    const antarLord = planetName(dasha.current.antardasha.lord, locale);
    const nakLord = nakshatraLord(nakIndex);
    const motion = dailyMotion("Moon", asOf); // deg/day — fast/slow Moon
    const fastMoon = motion > 13.2;

    const insights: { headline: string; body: string }[] =
      locale === "hi"
        ? [
            {
              headline: fastMoon ? "चंद्र तेज़ चल रहा है — दिन भी रफ़्तार से" : "चंद्र धीरे चल रहा है — दिन भी ठहराव से",
              body: `आज चंद्र ${nakshatraName(NAKSHATRAS[nakIndex], locale)} नक्षत्र में ${motion.toFixed(1)}°/दिवस की गति से चल रहा है। ${fastMoon ? "तेज़ चंद्र बदलाव और भागदौड़ लाता है — दिन के प्राथमिक काम जल्दी निपटाना शुभ माना जाता है।" : "धीमा चंद्र गहराई और स्थिरता लाता है — एक काम को अच्छे से पूरा करना आज की राह है।"} इसके स्वामी ${planetName(nakLord, locale)} हैं।`,
            },
            {
              headline: `आपकी ${antarLord} उप-दशा का प्रभाव`,
              body: `${mahaLord} महादशा के भीतर ${antarLord} की उप-दशा चल रही है। परंपरा इस दौर में ${LORD_MEANING_HI[dasha.current.antardasha.lord]} वाले कामों को प्राथमिकता देने का सुझाव देती है।`,
            },
            {
              headline: "सुनने का दिन",
              body: `चंद्र ${panchang.nakshatra.name} में होने से आज सुनना और समझना अनुकूल है। अपने ज़रूरी लोग जितने दिखते हैं, उससे ज़्यादा ग्रहणशील हैं — एक छोटी, सच्ची बातचीत बहुत दूर तक जाती है।`,
            },
          ]
        : [
            {
              headline: fastMoon ? "The Moon moves fast — so will the day" : "The Moon moves slowly — a day of depth",
              body: `The Moon travels through ${NAKSHATRAS[nakIndex]} today at ${motion.toFixed(1)}°/day. ${fastMoon ? "A fast Moon brings change and momentum — traditional practice favours finishing your priority tasks early." : "A slow Moon favours depth and steadiness — doing one thing well is today's natural rhythm."} Its lord is ${nakLord}.`,
            },
            {
              headline: `The ${dasha.current.antardasha.lord} sub-period colours today`,
              body: `Within your ${mahaLord} phase, the ${antarLord} sub-period is active. Traditional practice suggests prioritising matters connected to ${lordMeaning(dasha.current.antardasha.lord)} during this window.`,
            },
            {
              headline: "A day for listening",
              body: `With the Moon in ${panchang.nakshatra.name}, listening is favoured today. People close to you are more receptive than they appear — a short, honest exchange goes far.`,
            },
          ];
    const chosen = insights[Math.floor(norm360(moonNow) / 120) % insights.length];

    const nowHHMM = toLocalHHMM(asOf, input.timezone);
    const chog = currentChoghadiya(panchang, nowHHMM);

    return {
      provider: this.info,
      insight: {
        ...chosen,
        factors:
          locale === "hi"
            ? [
                { label: "वर्तमान दशा", value: `${mahaLord} → ${antarLord}` },
                { label: "चंद्र नक्षत्र", value: panchang.nakshatra.name },
                { label: "तिथि", value: panchang.tithi.name },
              ]
            : [
                { label: "Current phase", value: `${dasha.current.mahadasha.lord} → ${dasha.current.antardasha.lord}` },
                { label: "Moon's nakshatra", value: panchang.nakshatra.name },
                { label: "Tithi", value: panchang.tithi.name },
              ],
      },
      today: {
        tithi: panchang.tithi.name,
        nakshatra: panchang.nakshatra.name,
        nakshatraPada: panchang.nakshatra.pada,
        rahuKaal: panchang.rahuKaal,
        choghadiyaNow: chog,
        sunrise: panchang.sunrise,
        sunset: panchang.sunset,
      },
      dasha: {
        line:
          locale === "hi"
            ? `${mahaLord} दशा · ${antarLord} उप-दशा`
            : `${dasha.current.mahadasha.lord} phase · ${dasha.current.antardasha.lord} sub-period`,
        sub:
          locale === "hi"
            ? `परंपरागत ज्योतिष इसे ${LORD_MEANING_HI[dasha.current.mahadasha.lord]} और ${LORD_MEANING_HI[dasha.current.antardasha.lord]} से जोड़ता है।`
            : `Traditional astrology links this with ${lordMeaning(dasha.current.mahadasha.lord)} and ${lordMeaning(dasha.current.antardasha.lord)}.`,
      },
      transit: (() => {
        const jup = this.getTransit(input, asOf, locale).transits.find((t) => t.planet === "Jupiter");
        if (!jup) return { line: "" };
        return {
          line:
            locale === "hi"
              ? `गुरु आपके ${jup.natalHouse}वें भाव से गुज़र रहे हैं — ${HOUSE_THEMES_HI[jup.natalHouse]}।`
              : `Jupiter transits your ${jup.natalHouse}th house — ${HOUSE_THEMES[jup.natalHouse].toLowerCase()}.`,
        };
      })(),
    };
  }
}

// singleton
let instance: LiveAstrologyProvider | null = null;
export function getLiveAstrologyProvider(): LiveAstrologyProvider {
  if (!instance) instance = new LiveAstrologyProvider();
  return instance;
}

export { hhmmToMinutes };
