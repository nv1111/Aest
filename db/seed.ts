/**
 * Demo seed — astrologers & reviews. Clearly flagged isDemo: true.
 * Run: bun run db/seed.ts
 * Demo data is NEVER presented as real (AGENTS.md §8): verification states,
 * ratings and counts are demo values surfaced only with demo labelling.
 */

import { db } from "../src/lib/db";

interface SeedAstrologer {
  slug: string;
  displayName: string;
  photo: string;
  gender: string;
  expertise: string[];
  languages: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  consultationCount: number;
  pricePerMinute: number;
  isVerified: boolean;
  onlineStatus: "online" | "away" | "offline";
  availableFromHours?: number;
  about: string;
  consultationModes: string[];
}

const ASTROLOGERS: SeedAstrologer[] = [
  {
    slug: "devika-sharma",
    displayName: "Devika Sharma",
    photo: "/avatars/ast-01.png",
    gender: "female",
    expertise: ["Vedic Astrology", "Kundli", "Career"],
    languages: ["Hindi", "English"],
    experienceYears: 15,
    rating: 4.8,
    reviewCount: 214,
    consultationCount: 1840,
    pricePerMinute: 21,
    isVerified: true,
    onlineStatus: "online",
    about:
      "I practice classical Parashari astrology with a focus on career direction. Fifteen years of readings have taught me that a chart explains tendencies — choices remain yours. I keep my readings practical and jargon-free.",
    consultationModes: ["chat", "audio"],
  },
  {
    slug: "rajesh-iyer",
    displayName: "Rajesh Iyer",
    photo: "/avatars/ast-02.png",
    gender: "male",
    expertise: ["Vedic Astrology", "Dasha Analysis", "Finance"],
    languages: ["English", "Tamil", "Hindi"],
    experienceYears: 22,
    rating: 4.9,
    reviewCount: 389,
    consultationCount: 3120,
    pricePerMinute: 25,
    isVerified: true,
    onlineStatus: "online",
    about:
      "A retired banker turned full-time astrologer, I specialise in financial timing questions using dasha and transit analysis. Direct, calm, and honest about what astrology can and cannot answer.",
    consultationModes: ["chat", "audio", "video"],
  },
  {
    slug: "pandit-kesav-rao",
    displayName: "Pandit Kesav Rao",
    photo: "/avatars/ast-03.png",
    gender: "male",
    expertise: ["Kundli", "Muhurat", "Panchang"],
    languages: ["Telugu", "Hindi", "English"],
    experienceYears: 34,
    rating: 4.7,
    reviewCount: 512,
    consultationCount: 5400,
    pricePerMinute: 18,
    isVerified: true,
    onlineStatus: "online",
    about:
      "Third-generation astrologer from a family of temple purohits. My strength is muhurta selection and traditional panchang work. I explain every recommendation in plain words before you commit to anything.",
    consultationModes: ["chat", "audio"],
  },
  {
    slug: "ananya-mehta",
    displayName: "Ananya Mehta",
    photo: "/avatars/ast-04.png",
    gender: "female",
    expertise: ["Relationships", "Compatibility", "Kundli"],
    languages: ["Hindi", "English", "Gujarati"],
    experienceYears: 8,
    rating: 4.8,
    reviewCount: 156,
    consultationCount: 990,
    pricePerMinute: 16,
    isVerified: true,
    onlineStatus: "online",
    about:
      "I work mostly with compatibility and relationship questions. My approach: understand both charts, then focus on how two people can actually communicate better. No fear-based advice, ever.",
    consultationModes: ["chat"],
  },
  {
    slug: "vikram-bhatnagar",
    displayName: "Vikram Bhatnagar",
    photo: "/avatars/ast-05.png",
    gender: "male",
    expertise: ["Career", "Education", "Vedic Astrology"],
    languages: ["Hindi", "English"],
    experienceYears: 12,
    rating: 4.6,
    reviewCount: 198,
    consultationCount: 1420,
    pricePerMinute: 19,
    isVerified: true,
    onlineStatus: "away",
    availableFromHours: 2,
    about:
      "Former engineering recruiter, now a full-time astrologer. I combine chart analysis with real-world career experience — useful when the question is less 'what do the stars say' and more 'what should I actually do'.",
    consultationModes: ["chat", "audio", "video"],
  },
  {
    slug: "lakshmi-pillai",
    displayName: "Lakshmi Pillai",
    photo: "/avatars/ast-06.png",
    gender: "female",
    expertise: ["Vedic Astrology", "Health & Wellbeing", "Dasha Analysis"],
    languages: ["Malayalam", "English", "Hindi"],
    experienceYears: 19,
    rating: 4.9,
    reviewCount: 342,
    consultationCount: 2810,
    pricePerMinute: 23,
    isVerified: true,
    onlineStatus: "online",
    about:
      "I read charts the way my guru in Kerala taught me — slowly, and with context. Health-related readings stay grounded: I always ask you to pair astrology with proper medical care.",
    consultationModes: ["chat", "audio"],
  },
  {
    slug: "arjun-nair",
    displayName: "Arjun Nair",
    photo: "/avatars/ast-07.png",
    gender: "male",
    expertise: ["Transit Analysis", "Career", "Vedic Astrology"],
    languages: ["English", "Malayalam", "Hindi"],
    experienceYears: 10,
    rating: 4.5,
    reviewCount: 121,
    consultationCount: 860,
    pricePerMinute: 14,
    isVerified: true,
    onlineStatus: "online",
    about:
      "Transit-focused readings: what is actually happening in the sky right now and how it touches your chart. I believe good astrology is 80% listening and 20% speaking.",
    consultationModes: ["chat", "audio"],
  },
  {
    slug: "isha-kaur",
    displayName: "Isha Kaur",
    photo: "/avatars/ast-08.png",
    gender: "female",
    expertise: ["Relationships", "Marriage", "Kundli"],
    languages: ["Hindi", "Punjabi", "English"],
    experienceYears: 6,
    rating: 4.7,
    reviewCount: 89,
    consultationCount: 610,
    pricePerMinute: 12,
    isVerified: true,
    onlineStatus: "online",
    about:
      "Marriage and relationship readings with a modern outlook. I take compatibility seriously but never treat a score as a verdict — families and individuals deserve nuance, not panic.",
    consultationModes: ["chat", "audio"],
  },
  {
    slug: "savitri-devi",
    displayName: "Savitri Devi",
    photo: "/avatars/ast-09.png",
    gender: "female",
    expertise: ["Kundli", "Muhurat", "Traditional Remedies"],
    languages: ["Hindi"],
    experienceYears: 38,
    rating: 4.8,
    reviewCount: 468,
    consultationCount: 4900,
    pricePerMinute: 15,
    isVerified: true,
    onlineStatus: "away",
    availableFromHours: 5,
    about:
      "I have read charts for four decades. My readings are traditional, my remedies simple — prayer, routine, and patience. I will tell you plainly when a remedy is optional.",
    consultationModes: ["chat", "audio"],
  },
  {
    slug: "kabir-anand",
    displayName: "Kabir Anand",
    photo: "/avatars/ast-10.png",
    gender: "male",
    expertise: ["Numerology", "Vedic Astrology", "Career"],
    languages: ["English", "Hindi"],
    experienceYears: 7,
    rating: 4.4,
    reviewCount: 67,
    consultationCount: 480,
    pricePerMinute: 10,
    isVerified: true,
    onlineStatus: "online",
    about:
      "Numerology with an astrological backbone. Young professionals usually come to me for second opinions before big switches — job changes, relocations, naming decisions.",
    consultationModes: ["chat"],
  },
  {
    slug: "prof-harish-chandra",
    displayName: "Prof. Harish Chandra",
    photo: "/avatars/ast-11.png",
    gender: "male",
    expertise: ["Research Astrology", "Dasha Analysis", "Vedic Astrology"],
    languages: ["Hindi", "English"],
    experienceYears: 28,
    rating: 4.9,
    reviewCount: 295,
    consultationCount: 2210,
    pricePerMinute: 27,
    isVerified: true,
    onlineStatus: "offline",
    availableFromHours: 14,
    about:
      "Retired professor of mathematics. I approach jyotish as a rigorous system: precise dasha work, honest uncertainty, and zero sensationalism. For deep, patient analysis.",
    consultationModes: ["chat", "video"],
  },
  {
    slug: "meera-joshi",
    displayName: "Meera Joshi",
    photo: "/avatars/ast-12.png",
    gender: "female",
    expertise: ["Counselling", "Relationships", "Vedic Astrology"],
    languages: ["Marathi", "Hindi", "English"],
    experienceYears: 14,
    rating: 4.8,
    reviewCount: 233,
    consultationCount: 1760,
    pricePerMinute: 20,
    isVerified: true,
    onlineStatus: "online",
    about:
      "Trained counsellor and astrologer. Half my reading is chart analysis, half is helping you hear yourself clearly. Emotional safety comes first in every session.",
    consultationModes: ["chat", "audio", "video"],
  },
];

const REVIEW_TEXTS = [
  "Explained my dasha in words I actually understood. No fear tactics, no pressure to buy anything. Refreshing.",
  "Very patient with my questions. Told me honestly which parts of my chart were strong and where the reading was uncertain.",
  "I came in anxious about a job decision. Left with a clear, calm picture of timing and trade-offs. Worth the money.",
  "Practical and grounded. He explained the logic behind each point, and never once claimed certainty about outcomes.",
  "The best part: transparent pricing and zero upselling. The reading itself was detailed and kind.",
  "Helped me understand my compatibility report properly instead of just scaring us with scores. Very balanced view.",
  "Punctual, precise, and warm. The muhurta she suggested came with clear reasoning, not superstition.",
  "Answered every follow-up question patiently. Felt like talking to a wise teacher, not a salesperson.",
  "Straight to the point with genuine warmth. I appreciated the honesty about what astrology can't tell.",
  "Third consultation with her. Consistent quality, fair billing, and the summaries after each session are excellent.",
];

const REVIEWERS = [
  "Priya S.", "Rahul K.", "Anitha R.", "Manav D.", "Sneha B.", "Vivek M.",
  "Kavya T.", "Rohan G.", "Pooja N.", "Aditya V.", "Neha J.", "Sarthak P.",
];

async function main() {
  console.log("Seeding demo astrologers…");

  for (const a of ASTROLOGERS) {
    const existing = await db.astrologer.findUnique({ where: { slug: a.slug } });
    const data = {
      displayName: a.displayName,
      photoUrl: a.photo,
      gender: a.gender,
      expertise: JSON.stringify(a.expertise),
      languages: JSON.stringify(a.languages),
      experienceYears: a.experienceYears,
      rating: a.rating,
      reviewCount: a.reviewCount,
      consultationCount: a.consultationCount,
      pricePerMinute: a.pricePerMinute,
      isVerified: a.isVerified,
      onlineStatus: a.onlineStatus,
      availableFrom: a.availableFromHours ? new Date(Date.now() + a.availableFromHours * 3600000) : null,
      about: a.about,
      consultationModes: JSON.stringify(a.consultationModes),
      isDemo: true,
    };
    const record = existing
      ? await db.astrologer.update({ where: { id: existing.id }, data })
      : await db.astrologer.create({ data: { slug: a.slug, ...data } });

    // refresh demo reviews
    await db.review.deleteMany({ where: { astrologerId: record.id } });
    const nReviews = 5 + (a.slug.length % 4);
    for (let i = 0; i < nReviews; i++) {
      const idx = (a.slug.charCodeAt(0) + i * 7) % REVIEW_TEXTS.length;
      const rating = i % 7 === 6 ? 4 : 5;
      const daysAgo = 5 + ((i * 13 + a.slug.length) % 180);
      await db.review.create({
        data: {
          astrologerId: record.id,
          authorName: REVIEWERS[(i + a.slug.length) % REVIEWERS.length],
          rating,
          text: REVIEW_TEXTS[idx],
          createdAt: new Date(Date.now() - daysAgo * 86400000),
          isDemo: true,
        },
      });
    }
  }

  const count = await db.astrologer.count();
  console.log(`Seeded ${count} demo astrologers with reviews. Done.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect?.());
