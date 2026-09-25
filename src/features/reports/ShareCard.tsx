"use client";

/**
 * Share-as-image for ready reports.
 *
 * `ShareCard` is a 1080×1350 portrait card rendered with 100% inline styles
 * (html-to-image clones computed styles, so explicit hex values are used
 * instead of theme tokens — values mirror the globals.css tokens). It is
 * never mounted in the app tree: `captureShareCard` renders it into an
 * off-screen host via createRoot, waits for commit + fonts, and rasterises
 * it with html-to-image at pixelRatio 2.
 *
 * All card copy is localized at render time via t(); the report excerpt
 * itself comes from the stored report content (English is expected there
 * until report-content localization lands).
 */

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { reportService, type ReportView } from "@/services/reports";
import { useLocaleStore } from "@/store/locale";
import { t, type Locale } from "@/i18n";
import { trackEvent } from "@/lib/analytics";

// ------------------------------------------------------------------ geometry

const CARD_W = 1080;
const CARD_H = 1350;
const CARD_PADDING = 80;

// ------------------------------------------------------------------ palette
// Hex equivalents of the globals.css oklch tokens (computed once, hardcoded
// so the captured PNG never depends on CSS variable resolution).

const PAPER = "#fcf9f4"; // --background
const INK = "#2e241e"; // --foreground
const INK_SOFT = "rgba(46, 36, 30, 0.68)"; // muted ink for the excerpt
const TERRA = "#ab542e"; // --primary (terracotta)
const TERRA_LINE = "rgba(171, 84, 46, 0.4)";
const MUTED = "#6f645b"; // --muted-foreground
const HAIRLINE = "#e4dfd7"; // --hairline

// Font stacks: the CSS variables resolve against the live document (the
// off-screen host inherits html[lang]), and html-to-image copies the
// *computed* font-family and inlines matching @font-face rules. The
// system fallbacks guarantee rendering even when web-font embedding fails.

const SERIF =
  "var(--font-fraunces, Georgia), 'Noto Serif Devanagari', 'Devanagari Sangam MN', 'Nirmala UI', Georgia, 'Times New Roman', serif";
const SANS =
  "var(--font-geist-sans, system-ui), 'Noto Sans Devanagari', system-ui, -apple-system, 'Segoe UI', sans-serif";

// ------------------------------------------------------------------ copy helpers

/** i18n key per report type (falls back to the stored title). */
const TYPE_TITLE_KEYS: Record<string, string> = {
  kundli: "reports.typeKundli",
  career: "reports.typeCareer",
  marriage: "reports.typeMarriage",
  yearly: "reports.typeYearly",
  compatibility: "reports.typeCompatibility",
  consultation_summary: "reports.typeSummary",
};

/**
 * Generic titles the server stores (REPORT_TITLES mirror — data values, not
 * UI copy). When the stored title is one of these, the card personalises the
 * big serif line with the profile name instead of repeating the type badge.
 */
const GENERIC_TITLES = new Set([
  "kundli report",
  "career report",
  "marriage report",
  "yearly report",
  "compatibility report",
  "consultation summary",
]);

/** Section headings that are preamble rather than reading — skip for excerpts. */
const INTRO_HEADINGS = new Set(["Your basics", "About this report"]);

function typeLabel(type: string, fallbackTitle: string): string {
  const key = TYPE_TITLE_KEYS[type];
  return key ? t(key) : fallbackTitle;
}

/** First meaningful paragraph, whitespace-collapsed, capped with an ellipsis. */
function buildExcerpt(sections: { heading: string; body: string }[]): string {
  const chosen = sections.find((s) => !INTRO_HEADINGS.has(s.heading)) ?? sections[0];
  const firstPara = (chosen?.body ?? "")
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)[0];
  if (!firstPara) return "";
  if (firstPara.length <= 240) return firstPara;
  const cut = firstPara.slice(0, 240);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 160 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function formatCardDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ------------------------------------------------------------------ the card

const clamp = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

/**
 * The social share card itself. Purely presentational, inline-styled,
 * locale-aware (Devanagari gets smaller type with generous line-height so
 * ascenders and matras never clip).
 */
export function ShareCard({ report }: { report: ReportView }) {
  const locale = useLocaleStore((s) => s.locale);
  const hi = locale === "hi";

  const sections = report.sections ?? [];
  const excerpt = buildExcerpt(sections);
  const badgeText = typeLabel(report.type, report.title);
  const isGeneric = GENERIC_TITLES.has(report.title.trim().toLowerCase());

  const forProfile = report.profileName ? t("reports.forProfile", { name: report.profileName }) : "";
  const headline = isGeneric ? forProfile || badgeText : report.title;

  const metaParts = [formatCardDate(report.createdAt, locale)];
  if (report.profileName && headline !== forProfile) metaParts.push(forProfile);

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: "border-box",
        padding: CARD_PADDING,
        backgroundColor: PAPER,
        backgroundImage:
          "radial-gradient(130% 55% at 50% 0%, rgba(171, 84, 46, 0.06) 0%, rgba(171, 84, 46, 0) 62%)",
        color: INK,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* masthead */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: hi ? "0.28em" : "0.32em",
            lineHeight: 1.1,
            color: INK,
          }}
        >
          TARA
        </span>
        <span style={{ color: TERRA, fontSize: 22, lineHeight: 1 }} aria-hidden>
          ✦
        </span>
      </div>
      <div style={{ marginTop: 18, height: 2, backgroundColor: TERRA, borderRadius: 999 }} />

      {/* reading */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 16 }}>
        <span
          style={{
            alignSelf: "flex-start",
            fontFamily: SANS,
            fontSize: hi ? 22 : 20,
            fontWeight: 600,
            letterSpacing: hi ? "0.04em" : "0.2em",
            textTransform: "uppercase",
            color: TERRA,
            border: `1.5px solid ${TERRA_LINE}`,
            borderRadius: 999,
            padding: "10px 26px",
            lineHeight: hi ? 1.5 : 1.3,
          }}
        >
          {badgeText}
        </span>
        <h1
          style={{
            ...clamp(2),
            marginTop: 36,
            fontFamily: SERIF,
            fontSize: hi ? 42 : 48,
            fontWeight: 600,
            lineHeight: hi ? 1.5 : 1.18,
            letterSpacing: hi ? "0" : "-0.01em",
            color: INK,
          }}
        >
          {headline}
        </h1>
        <p style={{ marginTop: 18, fontSize: 22, lineHeight: 1.5, color: MUTED }}>
          {metaParts.filter(Boolean).join("  ·  ")}
        </p>

        {excerpt ? (
          <>
            <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ flex: 1, height: 1.5, backgroundColor: HAIRLINE, borderRadius: 999 }} />
              <span style={{ color: TERRA, fontSize: 26, lineHeight: 1 }} aria-hidden>
                ✦
              </span>
              <div style={{ flex: 1, height: 1.5, backgroundColor: HAIRLINE, borderRadius: 999 }} />
            </div>
            <p
              style={{
                ...clamp(3),
                marginTop: 22,
                fontFamily: SERIF,
                fontSize: hi ? 26 : 25,
                lineHeight: hi ? 1.78 : 1.62,
                color: INK_SOFT,
              }}
            >
              {excerpt}
            </p>
          </>
        ) : null}
      </div>

      {/* footer */}
      <div>
        <div style={{ height: 1.5, backgroundColor: HAIRLINE, borderRadius: 999 }} />
        <div style={{ marginTop: 30, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 500, lineHeight: 1.4, color: INK }}>
            {t("reports.shareCardTagline")}
          </span>
          <span style={{ color: TERRA, fontSize: 20, lineHeight: 1 }} aria-hidden>
            ✦
          </span>
        </div>
        <p style={{ marginTop: 12, fontSize: 17, lineHeight: hi ? 1.7 : 1.55, color: MUTED }}>
          {t("reports.disclaimer")}
          {"  ·  "}
          {t("common.demoData")}
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ capture

function imageFileName(report: { type: string; createdAt: string }): string {
  const d = new Date(report.createdAt);
  const date = Number.isNaN(d.getTime()) ? "unknown" : d.toISOString().slice(0, 10);
  const type = report.type.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return `tara-report-${type}-${date}.png`;
}

/** Render the card off-screen and rasterise it to a PNG blob. */
async function captureShareCard(report: ReportView): Promise<Blob> {
  const { toBlob } = await import("html-to-image");

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-9999px;top:0;width:${CARD_W}px;pointer-events:none;`;
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    root.render(<ShareCard report={report} />);
    // Let React commit, then let the browser lay out and paint twice.
    await new Promise((resolve) => setTimeout(resolve, 60));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      await document.fonts.ready;
    } catch {
      // fonts API unavailable — system fallbacks still render
    }

    const card = host.firstElementChild;
    if (!(card instanceof HTMLElement)) throw new Error("share_card_not_rendered");

    const blob = await toBlob(card, {
      pixelRatio: 2,
      width: CARD_W,
      height: CARD_H,
      backgroundColor: PAPER,
    });
    if (!blob) throw new Error("share_capture_failed");
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ------------------------------------------------------------------ hook

/**
 * Share-as-image flow for both the details screen and list rows.
 * Fetches full sections when the list payload omits them, captures the
 * card, then prefers the Web Share API (files) and falls back to a
 * download. `pendingId` drives spinner/disabled states per report.
 */
export function useShareReportImage() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const busy = useRef(false);

  const share = useCallback(async (report: ReportView) => {
    if (busy.current) return;
    busy.current = true;
    setPendingId(report.id);
    try {
      let full: ReportView = report;
      if (!full.sections || full.sections.length === 0) {
        full = (await reportService.details(report.id)).report;
      }
      if (full.status !== "ready" || !full.sections || full.sections.length === 0) {
        throw new Error("report_not_ready");
      }

      const blob = await captureShareCard(full);
      const name = imageFileName(full);
      const file = new File([blob], name, { type: "image/png" });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: full.title });
          toast.success(t("reports.shareSaved"));
          trackEvent("report_downloaded", { type: full.type, via: "image" });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return; // user dismissed the share sheet — not an error
          }
          // other share failures fall through to the download fallback
        }
      }

      triggerDownload(blob, name);
      toast.success(t("reports.shareSaved"));
      trackEvent("report_downloaded", { type: full.type, via: "image" });
    } catch {
      toast.error(t("reports.shareFailed"));
    } finally {
      busy.current = false;
      setPendingId(null);
    }
  }, []);

  return { share, pendingId };
}

export default ShareCard;
