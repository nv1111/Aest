const astrology = {
  // ---------------------------------------------------------------- hub
  title: "Astrology",
  hubSubtitle: "Your chart, phases and the sky today",
  hubNoProfileTitle: "Add your birth details",
  hubNoProfileBody:
    "Your kundli, life phases, transits and daily timings are all read from your birth details. Add them to begin — it takes a minute.",
  hubNoProfileCta: "Add birth details",
  hubTrustTitle: "Where these numbers come from",
  hubTrustBody:
    "Every value here is calculated from your birth date, time and place using traditional Vedic methods — the same system an astrologer reads from. You can edit or delete your birth details anytime.",

  // module names (hub cards)
  kundli: "Kundli",
  kundliSubtitle: "Your birth chart",
  dasha: "Dasha",
  dashaSubtitle: "Your life phases",
  transit: "Transits",
  transitSubtitle: "Planets moving now",
  panchang: "Panchang",
  panchangSubtitle: "Today's timings",
  horoscope: "Horoscope",
  horoscopeSubtitle: "Daily and beyond",
  compatibility: "Compatibility",
  compatibilitySubtitle: "Match two charts",

  // ---------------------------------------------------------------- kundli
  overview: "Overview",
  lagna: "Lagna (ascendant)",
  rashi: "Moon sign",
  sunSign: "Sun sign",
  nakshatra: "Nakshatra",
  pada: "Pada",
  lord: "Lord",
  highlights: "What stands out",
  planetarySummary: "Planetary summary",
  timeAccuracyNote: "A note on timing",
  viewChart: "View chart",
  viewPlanets: "Planet details",
  houseChip: "H{house}",
  degreeFormat: "{sign} · {deg}°",
  lagnaApprox: "approximate",

  // ---------------------------------------------------------------- chart
  chart: "Chart",
  chartSubtitle: "Your chart, house by house",
  legend: "Legend",
  d1: "D1 · Rashi",
  d9: "D9 · Navamsa",
  d10: "D10 · Career",
  legendHouse: "Circled number = house",
  legendSign: "Small number = rashi (sign)",
  legendRetro: "R = retrograde",
  tapHouseHint: "Tap any house to see what it means",
  houseTitle: "House {n}",
  signLordLabel: "Sign lord",
  planetsHere: "Planets here",
  emptyHouse: "No planets sit in this house — it is still read through its sign and lord.",
  houseTheme: "What this house speaks about",

  // ---------------------------------------------------------------- planets
  planets: "Planets",
  planetsSubtitle: "Where each graha sits in your chart",
  planetAbout: "About {planet}",
  signLordShort: "Sign lord",
  nakshatraLordShort: "Nakshatra lord",
  retrograde: "R",
  retrogradeLong: "Retrograde",
  retroNote:
    "A retrograde planet appears to move backwards from Earth. Traditional astrology reads this as the planet's themes turning inward — slower, more reflective, often replayed twice.",
  planetMeaningTitle: "What it represents in your chart",

  // planet educational copy (static, plain language)
  planetSunTitle: "Sun — identity and purpose",
  planetSunBody:
    "The Sun is the centre of the chart: your sense of self, vitality and the direction you grow towards. Where it sits shows the stage of life where you are meant to shine and take responsibility. A strong Sun is read as confidence and clarity of purpose — not fame or power by itself.",
  planetMoonTitle: "Moon — the emotional core",
  planetMoonBody:
    "The Moon is your inner weather: how you feel, nurture and react before thinking. Its sign and nakshatra describe what comforts you and what unsettles you. In traditional jyotish the Moon carries special weight — it colours daily mood and is the basis of your rashi.",
  planetMarsTitle: "Mars — energy and drive",
  planetMarsBody:
    "Mars is how you act: effort, courage, competition and anger. Its placement shows where you invest energy and how you handle friction. Read constructively, Mars is the engine of initiative — the same force that argues is the one that builds.",
  planetMercuryTitle: "Mercury — thinking and speech",
  planetMercuryBody:
    "Mercury governs how you process and share information: analysis, language, humour, trade. Its position describes your natural way of learning and explaining. A busy Mercury is traditionally read as curiosity and versatility of mind.",
  planetJupiterTitle: "Jupiter — growth and wisdom",
  planetJupiterBody:
    "Jupiter is expansion: learning, mentors, children, generosity, meaning. Where it sits is where life tends to grow and where you are asked to be generous. It is called the great benefic — traditional astrology reads it as protection and perspective.",
  planetVenusTitle: "Venus — love and values",
  planetVenusBody:
    "Venus is what you find beautiful and worth loving: romance, art, comfort, harmony in relationships. Its sign describes your language of affection and your taste. Venus is not only about partners — it is about all things you genuinely enjoy and value.",
  planetSaturnTitle: "Saturn — discipline and time",
  planetSaturnBody:
    "Saturn is the teacher of the chart: structure, patience, boundaries and long results. Its house shows where effort compounds slowly and where shortcuts fail. Traditional astrology reads Saturn's pressure as delayed, not denied — the fruit ripens late.",
  planetRahuTitle: "Rahu — ambition and appetite",
  planetRahuBody:
    "Rahu is the north node of the Moon — a point, not a planet. It represents hunger for experience: novelty, foreign things, technology, status. Where it sits, life feels magnified and restless. Tradition reads Rahu as growth through unusual paths, needing conscious grounding.",
  planetKetuTitle: "Ketu — release and detachment",
  planetKetuBody:
    "Ketu is the south node of the Moon — the mirror point of Rahu. It represents letting go: spirituality, past mastery, indifference to what others chase. Its house shows where you naturally withdraw and where insight comes without effort. Read as moksha's quiet friend.",

  // ---------------------------------------------------------------- dasha
  dashaTitle: "Dasha",
  dashaQuestion: "What phase am I in now?",
  mahadasha: "Mahadasha",
  antardasha: "Antardasha",
  pratyantardasha: "Pratyantardasha",
  currentChip: "Current",
  dashaTimeline: "Your phase timeline",
  dashaYouAreHere: "You are here",
  yearsSpan: "{years} yrs",
  dashaChipAria: "{lord} mahadasha, {years} years",
  dashaAsOf: "As of {date}",
  dashaElapsed: "{pct}% through this phase",
  antardashasWithin: "Phases within {lord}'s mahadasha",
  dashaTimelineHint: "Scroll to see the full 120-year Vimshottari cycle",

  // ---------------------------------------------------------------- transit
  transitTitle: "What's moving through your chart",
  majorMovers: "Major movers",
  fasterPlanets: "Faster planets",
  transitAsk: "What does this mean for me?",
  transitQuestion: "What does {planet} transiting my {house}th house mean for me right now?",
  transitHouse: "your {house}th house",
  transitSince: "Since {date} · until {date2}",
  transitRetro: "Retrograde right now — its themes may feel slower, more inward.",
  transitNotable: "Worth noting",
  asOf: "As of {date}",
  transitInSign: "in {sign}",
  transitUntil: "until {date}",

  // ---------------------------------------------------------------- panchang
  today: "Today",
  tomorrow: "Tomorrow",
  pickDate: "Pick date",
  timingsFor: "Timings for {place}",
  defaultLocationNote: "Showing timings for New Delhi — add your birth place for local timings.",
  sunrise: "Sunrise",
  sunset: "Sunset",
  moonrise: "Moonrise",
  moonset: "Moonset",
  tithi: "Tithi",
  yoga: "Yoga",
  karana: "Karana",
  vara: "Vara",
  endsAt: "ends {date}",
  panchangFive: "The five angas",
  panchangTakeaway: "Today in one line",
  carefulWindows: "Careful windows",
  goodWindows: "Auspicious window",
  rahuKaal: "Rahu Kaal",
  yamaganda: "Yamaganda",
  gulika: "Gulika",
  abhijit: "Abhijit Muhurat",
  avoidLabel: "Avoid",
  goodLabel: "Good",
  neutralLabel: "Neutral",
  choghadiyaTitle: "Choghadiya",
  choghadiya: "Choghadiya",
  choghadiyaDay: "Day",
  choghadiyaNight: "Night",
  choghadiyaHint: "The day and night are each divided into eight slots of roughly 1.5 hours. Quality labels are traditional guidance, not commandments.",
  nowLabel: "Now",
  learnMore: "Learn more",

  // panchang learn-more copy (calm, factual)
  learnTithiBody:
    "Tithi is the Moon's phase — the distance between Moon and Sun, divided into 30 steps of a lunar month. The same way the Moon waxes and wanes, tradition reads tithi as the general tempo of the day: waxing phases for beginnings and growth, waning phases for closing and consolidating.",
  learnNakshatraBody:
    "Nakshatra is the constellation the Moon is passing through — one of 27 lunar mansions, each split into four padas (steps). Your birth nakshatra shapes temperament in traditional readings; today's nakshatra is simply where the Moon is now, flavouring the mood of the day.",
  learnYogaBody:
    "Yoga is a calculated angle between Sun and Moon, giving 27 possible combinations. Each yoga has a traditional character — some are considered smooth for flow and cooperation, others uneven. It is one of the five angas (limbs) of the panchang, read together rather than alone.",
  learnKaranaBody:
    "A karana is half a tithi — the Moon-Sun angle split into 60 steps. There are 11 repeating karanas, each with a small traditional signature for how the half-day feels. Karana is a fine detail: astrologers weigh it lightly compared to tithi and nakshatra.",
  learnVaraBody:
    "Vara is the weekday, and each day is ruled by a planetary lord — Sunday by the Sun, Monday by the Moon, and so on. The ruling lord gives the day a general flavour in tradition: Thursday (Jupiter) is associated with teachers and generosity, Saturday (Saturn) with steady, serious work.",
  learnRahuBody:
    "Rahu Kaal is a daily window of roughly 90 minutes, computed as a fixed portion of the daytime. Traditional practice avoids starting important new work during it — not because something terrible happens, but because outcomes started here are read as unstable. Anything already in progress continues unaffected.",
  learnAbhijitBody:
    "Abhijit Muhurat is the roughly 48-minute window around local noon — the eighth part of the day when the Sun is at its peak. Tradition treats it as the day's most auspicious slot for beginning anything important, a kind of built-in golden hour.",
  learnChoghadiyaBody:
    "Choghadiya divides day and night into eight slots each and labels them good, neutral or avoidable. It is a folk-friendly timing system: instead of computing a full muhurat, you simply pick a good slot for starting work. The labels are traditional guidance, not commandments.",

  // ---------------------------------------------------------------- horoscope
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  basisNote: "Basis",
  moonSignLabel: "Moon sign",
  energyToday: "Energy",
  energy1: "Resting",
  energy2: "Steady",
  energy3: "Building",
  energy4: "Flowing",
  energy5: "Radiant",
  energyCaption: "A rhythm to work with — not a fixed outcome.",
  inDetail: "In detail",

  // ---------------------------------------------------------------- compatibility
  checkCompatibility: "Check compatibility",
  compatSubtitle: "Match two charts",
  compatPickA: "First person",
  compatPickB: "Second person",
  compatPickBHint: "Choose a saved profile, or add birth details below.",
  compatYou: "You",
  compatAddProfile: "Add birth details",
  compatCalculate: "Calculate match",
  compatCalculating: "Calculating…",
  compatOtherProfiles: "Your saved profiles",
  fieldName: "Name",
  fieldDob: "Date of birth",
  fieldTime: "Time of birth",
  fieldPlace: "Birth place",
  accuracyExact: "Exact",
  accuracyApproximate: "Approximate",
  accuracyUnknown: "Unknown",
  accuracyUnknownHint: "The match can still be calculated — some factors will be marked approximate.",
  errNameRequired: "Please enter their name.",
  errDobRequired: "Please enter their date of birth.",
  errPlaceRequired: "Please search for their birth place.",
  errTimeRequired: "Add a time, or mark it as unknown.",
  compatScore: "Ashtakoota score",
  compatOutOf: "out of {max}",
  compatKootas: "The eight factors",
  compatThemes: "What this means",
  compatUnderstand: "Understand this match",
  compatManglik: "Manglik status",
  compatManglikYes: "Manglik",
  compatManglikNo: "Not manglik",
  compatDisclaimer: "A compatibility score is a traditional screening tool — not a verdict on any relationship.",
  compatDisclaimerNote: "Ashtakoota is one traditional lens. Families and astrologers weigh it differently — many give it no weight at all. No score can measure effort, respect or communication, which is what relationships are actually built on.",
  compatResultFor: "{a} & {b}",
  compatSelected: "Selected",
  compatAskQuestion: "Help me understand my compatibility with {name} — what should we both know?",
  checkAnother: "Check another match",

  // ---------------------------------------------------------------- generic
  advancedDetails: "Advanced details",
};

export default astrology;
