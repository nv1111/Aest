/**
 * MOCK ENGINE — deterministic horoscope readings per (moonSign, period, date).
 * Text is template-based, seeded, calm and non-predictive in tone.
 */

import type { HoroscopePeriod, HoroscopeReading, SignName } from "../types";
import { hashString, mulberry32 } from "./positions";

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

const ENERGY: string[] = ["Low", "Steady", "Building", "High", "Peak"];

export function energyLabel(rating: number): string {
  return ENERGY[Math.min(4, Math.max(0, rating - 1))];
}

export function buildHoroscope(
  moonSign: SignName,
  moonSignIndex: number,
  period: HoroscopePeriod,
  asOf: Date,
  provider: HoroscopeReading["provider"]
): HoroscopeReading {
  const dateLabel =
    period === "daily"
      ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(asOf)
      : period === "weekly"
        ? `Week of ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(asOf)}`
        : period === "monthly"
          ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(asOf)
          : String(asOf.getFullYear());

  const key = `${period}|${moonSign}|${period === "daily" ? asOf.toISOString().slice(0, 10) : period === "weekly" ? String(getISOWeek(asOf)) : period === "monthly" ? asOf.toISOString().slice(0, 7) : asOf.getFullYear()}`;
  const rng = mulberry32(hashString(key));

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  return {
    provider,
    period,
    basis: `This reading is based on your Moon sign (${moonSign}). It is general guidance shaped by your chart context — not a fixed prediction.`,
    moonSign,
    dateLabel,
    headline: pick(HEADLINES[period]),
    summary: pick(SUMMARIES[period]),
    sections: SECTIONS.map((s) => ({ title: s.title, body: pick(s.bodies) })),
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
