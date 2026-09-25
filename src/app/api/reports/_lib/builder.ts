/**
 * Report content builder — SERVER ONLY.
 *
 * Turns provider output (BirthChart / DashaInfo / TransitInfo) into calm,
 * plain-language report sections [{heading, body}]. No astrology math here —
 * everything is read from the normalized provider types (AGENTS.md §2).
 *
 * Tone rules (AGENTS.md §5): "traditional astrology interprets this as…",
 * never guarantees, always ends with the honest "How to read this" section.
 */

import { db } from "@/lib/db";
import { provider, resolveProfileInput } from "@/lib/astrology/server";
import type {
  AstrologyInput,
  BirthChart,
  DashaInfo,
  TransitEntry,
  TransitInfo,
} from "@/lib/astrology/types";
import type { Report } from "@prisma/client";
import type { ReportSectionDTO } from "@/types/models";

export interface Section {
  heading: string;
  body: string;
}

/** Chart-based report types this builder knows how to build. */
export const CHART_REPORT_TYPES = new Set(["kundli", "career", "marriage", "yearly", "compatibility"]);

export const REPORT_TITLES: Record<string, string> = {
  kundli: "Kundli report",
  career: "Career report",
  marriage: "Marriage report",
  yearly: "Yearly report",
  compatibility: "Compatibility report",
  consultation_summary: "Consultation summary",
};

// ------------------------------------------------------------------ copy maps

const PLANET_THEMES: Record<string, string> = {
  Sun: "identity, vitality and how you lead",
  Moon: "mind, moods and what feels like home",
  Mars: "energy, drive and how you act",
  Mercury: "thinking, speech and learning",
  Jupiter: "growth, luck and mentorship",
  Venus: "love, comfort and taste",
  Saturn: "discipline, patience and long-term structure",
  Rahu: "ambition and the pull of the new",
  Ketu: "detachment, depth and quiet intuition",
};

const CAREER_THEMES: Record<string, string> = {
  Sun: "leadership, authority and visibility — a phase where taking charge is traditionally read as favourable",
  Moon: "public-facing, people-centred work where responsiveness matters",
  Mars: "execution and momentum — building, selling, competing",
  Mercury: "analysis, communication and trade — writing, numbers, negotiation",
  Jupiter: "advisory and teaching — work that grows other people",
  Venus: "design, aesthetics and relationship-building",
  Saturn: "structure and consolidation — long projects that reward patience",
  Rahu: "unconventional paths, technology and foreign connections",
  Ketu: "research, specialisation and quiet mastery",
};

const RELATIONSHIP_THEMES: Record<string, string> = {
  Sun: "clarity and confidence in how you show up with a partner",
  Moon: "nurturing and emotional closeness",
  Mars: "passion and directness — with a need to mind friction",
  Mercury: "conversation and shared curiosity keep the bond alive",
  Jupiter: "generosity, shared beliefs and growing together",
  Venus: "romance, affection and shared pleasures",
  Saturn: "commitment and steadiness — slow to form, durable once formed",
  Rahu: "a strong pull toward the unfamiliar in partners",
  Ketu: "a quiet, spiritual kind of companionship",
};

const HOW_TO_READ = [
  "This report is generated from your chart using traditional jyotish factors, described in plain language. It is reflective guidance to think with — not a prediction, and never a guarantee about outcomes.",
  "This is a demo build: positions are computed by our demo engine (demo data) while a verified engine is being connected. This is not advice from a human astrologer — for a person-to-person reading, start a consultation.",
  "Use what resonates, question what doesn't. Astrology at its best is a mirror, not a script.",
].join("\n\n");

// ------------------------------------------------------------------ helpers

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function planetLine(p: BirthChart["planets"][number]): string {
  const theme = PLANET_THEMES[p.planet] ?? "its natural significations";
  return `${p.planet} sits in ${p.sign} in house ${p.house}${p.isRetrograde ? " (retrograde)" : ""} — it colours ${theme}.`;
}

function houseLine(chart: BirthChart, n: number, label: string): string {
  const h = chart.houses.find((x) => x.house === n);
  if (!h) return `House ${n} (${label}) could not be read from this chart.`;
  const planetsClause = h.planets.length ? `, with ${listJoin(h.planets)} placed in it` : " with no planets placed in it";
  return `Your house ${n} — ${label} — is ${h.sign}, ruled by ${h.signLord}${planetsClause}. Traditional astrology reads the state of this house as a mirror of ${label.toLowerCase()} in your life.`;
}

function transitLine(t: TransitEntry): string {
  return `${t.planet} is transiting ${t.currentSign}, moving through your natal house ${t.natalHouse} until ${monthYear(t.endsOn)}${t.isRetrograde ? " (currently retrograde — a review phase)" : ""}. ${t.interpretation}`;
}

function dashaPeriodLine(dasha: DashaInfo): string {
  const { mahadasha, antardasha } = dasha.current;
  return `You are in the ${mahadasha.lord} mahadasha until ${monthYear(mahadasha.end)}, currently in the ${antardasha.lord} antardasha until ${monthYear(antardasha.end)}.`;
}

function accuracyNote(input: AstrologyInput): string {
  if (input.timeAccuracy === "unknown") {
    return "Your birth time is marked unknown, so the lagna and all house placements in this report are approximate. A birth time (even approximate) would sharpen the houses considerably.";
  }
  if (input.timeAccuracy === "approximate") {
    return "Your birth time is marked approximate. House placements here are close but may shift by one house either way — treat them as indicative rather than exact.";
  }
  return "Your birth time is marked exact, so house placements are computed as precisely as the demo engine allows.";
}

// ------------------------------------------------------------------ builders

function kundliSections(input: AstrologyInput, chart: BirthChart, dasha: DashaInfo): Section[] {
  return [
    {
      heading: "Your basics",
      body: [
        `Your lagna (rising sign) is ${chart.ascendant.sign}${chart.ascendant.isApproximate ? " — approximate, because your birth time is not exact" : ""}, ruled by ${chart.ascendant.lord}.`,
        `Your rashi (moon sign) is ${chart.moonSign.sign} — ${chart.moonSign.sanskrit} in Sanskrit — and your sun sign is ${chart.sunSign.sign} (${chart.sunSign.sanskrit}).`,
        `You were born under the ${chart.nakshatra.name} nakshatra, pada ${chart.nakshatra.pada}, whose lord is ${chart.nakshatra.lord}.`,
        chart.note,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    {
      heading: "What stands out",
      body:
        chart.keyHighlights.length > 0
          ? chart.keyHighlights.map((h) => `${h.title} — ${h.body}`).join("\n\n")
          : "Nothing unusual stands out in this chart — a balanced set of placements.",
    },
    {
      heading: "Your planets",
      body: chart.planets.map(planetLine).join("\n"),
    },
    {
      heading: "Your current phase",
      body: `${dasha.simpleReading.headline}\n\n${dasha.simpleReading.body}\n\n${dashaPeriodLine(dasha)}`,
    },
    {
      heading: "Timing note",
      body: `${accuracyNote(input)}\n\nAll positions in this build come from our demo engine — clearly labelled demo data — while a verified engine is being connected.`,
    },
    { heading: "How to read this", body: HOW_TO_READ },
  ];
}

function careerSections(input: AstrologyInput, chart: BirthChart, dasha: DashaInfo, transit: TransitInfo): Section[] {
  const { mahadasha, antardasha } = dasha.current;
  const saturn = transit.transits.find((t) => t.planet === "Saturn");
  const jupiter = transit.transits.find((t) => t.planet === "Jupiter");

  const timing = [
    `You are in the ${mahadasha.lord} mahadasha until ${monthYear(mahadasha.end)}, with the ${antardasha.lord} antardasha until ${monthYear(antardasha.end)}.`,
    `Traditional astrology reads a ${mahadasha.lord} period at work as a time of ${CAREER_THEMES[mahadasha.lord] ?? "steady effort"}. Within it, the ${antardasha.lord} sub-period colours the tone further — ${CAREER_THEMES[antardasha.lord] ?? "a shift in rhythm rather than direction"}.`,
    "Neither is a verdict on your career. Think of them as weather to plan around, not a forecast of results.",
  ].join("\n\n");

  const transits = [
    saturn ? transitLine(saturn) : null,
    jupiter ? transitLine(jupiter) : null,
  ]
    .filter(Boolean)
    .join("\n\n") || "No major Saturn or Jupiter transits are active right now.";

  return [
    {
      heading: "Your career houses",
      body: `${houseLine(chart, 10, "career, status and responsibility")}\n\n${houseLine(chart, 6, "work, health and daily routine")}\n\n${houseLine(chart, 2, "money, family and speech")}`,
    },
    { heading: "Your current phase at work", body: timing },
    { heading: "What's moving around you", body: `${transits}\n\n${accuracyNote(input)}` },
    { heading: "How to read this", body: HOW_TO_READ },
  ];
}

function marriageSections(input: AstrologyInput, chart: BirthChart, dasha: DashaInfo): Section[] {
  const { mahadasha, antardasha } = dasha.current;
  const venus = chart.planets.find((p) => p.planet === "Venus");
  const jupiter = chart.planets.find((p) => p.planet === "Jupiter");

  const planets = [
    venus ? `${planetLine(venus)} Venus is the karaka (natural significator) of partnership, so its sign and house are read closely in marriage questions.` : null,
    jupiter ? `${planetLine(jupiter)} Jupiter is read as the partner-giver in tradition — where it sits is traditionally read as shaping the quality of what a partner brings.` : null,
  ]
    .filter(Boolean)
    .join("\n\n") || "Venus and Jupiter could not be read from this chart.";

  const timing = [
    `You are in the ${mahadasha.lord} mahadasha with the ${antardasha.lord} antardasha until ${monthYear(dasha.current.antardasha.end)}.`,
    `Tradition reads a ${mahadasha.lord} period as bringing ${RELATIONSHIP_THEMES[mahadasha.lord] ?? "a particular texture"} to relationships, and the ${antardasha.lord} sub-period as ${RELATIONSHIP_THEMES[antardasha.lord] ?? "a shift in tone"}.`,
    "This is descriptive, not predictive. A marriage is built by two people; no chart decides it.",
  ].join("\n\n");

  return [
    {
      heading: "Your partnership houses",
      body: `${houseLine(chart, 7, "partnership, marriage and contracts")}\n\n${houseLine(chart, 5, "romance, creativity and children")}`,
    },
    { heading: "Venus and Jupiter", body: planets },
    { heading: "Relationship timing", body: timing },
    { heading: "Timing note", body: accuracyNote(input) },
    { heading: "How to read this", body: HOW_TO_READ },
  ];
}

function yearlySections(input: AstrologyInput, chart: BirthChart, dasha: DashaInfo, transit: TransitInfo): Section[] {
  const { mahadasha, antardasha } = dasha.current;
  const active = dasha.timeline.find((t) => t.isActive);
  const progress = active ? Math.round(active.progress * 100) : null;

  const upcoming = dasha.antardashas
    .filter((a) => new Date(a.start).getTime() >= Date.now() - 86400000)
    .slice(0, 5);
  const timeline =
    upcoming.length > 0
      ? upcoming
          .map(
            (a) =>
              `${a.lord} antardasha — ${monthYear(a.start)} to ${monthYear(a.end)}: traditionally read as ${PLANET_THEMES[a.lord] ?? "its natural significations"} moving to the front.`
          )
          .join("\n")
      : "No further antardasha dates are available for this chart.";

  const notable =
    transit.notable.length > 0
      ? transit.notable.map((n) => `• ${n}`).join("\n")
      : "No headline transits are active right now.";

  const themes = [
    `Your year runs mainly under the ${mahadasha.lord} mahadasha${progress != null ? ` (${progress}% complete)` : ""}, with the ${antardasha.lord} antardasha until ${monthYear(antardasha.end)}. Traditional astrology reads the year through these two layers: the mahadasha sets the broad subject — ${PLANET_THEMES[mahadasha.lord] ?? "steady growth"} — and the antardasha decides the immediate colour.`,
    `Grounded in your chart, the honest themes for this year look like: ${CAREER_THEMES[mahadasha.lord] ?? "steady effort"} in work, ${RELATIONSHIP_THEMES[mahadasha.lord] ?? "steady warmth"} in close bonds, and — from the transits — moments to act and moments to wait. Plan around the rhythm rather than betting on a single date.`,
  ].join("\n\n");

  return [
    {
      heading: "Your year in one line",
      body: `${dashaPeriodLine(dasha)}${progress != null ? ` The ${mahadasha.lord} mahadasha is about ${progress}% complete.` : ""}`,
    },
    { heading: "Your antardasha timeline", body: timeline },
    { heading: "Notable transits", body: `${notable}\n\n${accuracyNote(input)}` },
    { heading: "Year themes", body: themes },
    { heading: "How to read this", body: HOW_TO_READ },
  ];
}

function compatibilitySections(input: AstrologyInput, chart: BirthChart): Section[] {
  const venus = chart.planets.find((p) => p.planet === "Venus");
  return [
    {
      heading: "About this report",
      body: "A full jyotish compatibility reading — guna or koota matching — compares two charts side by side. It needs a second person's birth details, so a single-chart report can only offer context, not a match score.",
    },
    {
      heading: "What your chart alone suggests",
      body: [
        houseLine(chart, 7, "partnership, marriage and contracts"),
        venus ? planetLine(venus) : null,
        "These are the factors a full match would weigh on your side. The other chart supplies the other half.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    {
      heading: "Where the full match lives",
      body: "Open Astrology → Compatibility for a two-chart match. It scores the traditional 36-point koota match and explains each factor in plain language, with both charts treated equally.",
    },
    { heading: "How to read this", body: HOW_TO_READ },
  ];
}

// ------------------------------------------------------------------ public api

export interface BuildInput {
  chart: BirthChart;
  dasha: DashaInfo;
  transit: TransitInfo;
}

export function buildSections(type: string, input: AstrologyInput, data: BuildInput): Section[] {
  switch (type) {
    case "kundli":
      return kundliSections(input, data.chart, data.dasha);
    case "career":
      return careerSections(input, data.chart, data.dasha, data.transit);
    case "marriage":
      return marriageSections(input, data.chart, data.dasha);
    case "yearly":
      return yearlySections(input, data.chart, data.dasha, data.transit);
    case "compatibility":
      return compatibilitySections(input, data.chart);
    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

/**
 * Builds report content server-side from the provider and persists it as
 * "ready". Returns the updated row, or the row marked "failed" when the
 * profile is missing or the provider fails. Never throws.
 */
export async function buildAndPersist(report: Report): Promise<Report> {
  try {
    const resolved = await resolveProfileInput(report.userId, report.profileId);
    if (!resolved) {
      // Profile was deleted after generation started — fail honestly.
      return db.report.update({
        where: { id: report.id },
        data: { status: "failed", completedAt: new Date() },
      });
    }

    const { input } = resolved;
    const p = provider();
    const data: BuildInput = {
      chart: p.getBirthChart(input),
      dasha: p.getDasha(input),
      transit: p.getTransit(input),
    };

    const sections: Section[] = buildSections(report.type, input, data);
    const updated = await db.report.update({
      where: { id: report.id },
      data: {
        status: "ready",
        completedAt: new Date(),
        contentJson: JSON.stringify(sections satisfies ReportSectionDTO[]),
      },
    });

    await db.notification.create({
      data: {
        userId: report.userId,
        type: "report",
        title: "Report ready",
        body: `${report.title} is ready to view.`,
      },
    });

    return updated;
  } catch {
    return db.report.update({
      where: { id: report.id },
      data: { status: "failed", completedAt: new Date() },
    });
  }
}

/** Serialized report wire format (ReportDTO + profile helpers). */
export interface SerializedReport {
  id: string;
  type: string;
  title: string;
  status: string;
  sections: ReportSectionDTO[] | null;
  createdAt: Date;
  completedAt: Date | null;
  profileId: string | null;
  profileName?: string | null;
}

/** Serialize a Report row for the wire (sections parsed from contentJson). */
export function serializeReport(
  row: Report,
  opts?: { includeSections?: boolean; profileName?: string | null }
): SerializedReport {
  let sections: ReportSectionDTO[] | null = null;
  if (opts?.includeSections !== false && row.contentJson) {
    try {
      const parsed: unknown = JSON.parse(row.contentJson);
      if (Array.isArray(parsed)) {
        sections = parsed.filter(
          (s): s is ReportSectionDTO =>
            typeof s === "object" && s !== null && "heading" in s && "body" in s
        );
      }
    } catch {
      sections = null;
    }
  }
  const result: SerializedReport = {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    sections,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    profileId: row.profileId,
  };
  if (opts?.profileName !== undefined) result.profileName = opts.profileName;
  return result;
}
