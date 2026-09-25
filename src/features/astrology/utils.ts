/**
 * Astrology feature local utils — date/time presentation helpers only.
 * No astrology math here (presentation formatting only).
 */

/** Today's date on the device, as YYYY-MM-DD. */
export function localDateISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date object → YYYY-MM-DD (local, not UTC). */
export function dateToISO(date: Date): string {
  return localDateISO(date);
}

/** "HH:mm" (24h) → "6:12 AM" style, human-friendly. */
export function formatHHMM(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Current "HH:mm" (24h) in a given IANA timezone. */
export function nowInTimezone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    return parts;
  } catch {
    return "";
  }
}

/** formatDateIN "short" style, locale-aware (hi-IN in Hindi mode). */
export function formatDateLocale(iso: string | Date, locale: "en" | "hi"): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(iso instanceof Date ? iso : new Date(iso));
}

/** Is `now` (HH:mm) within [start, end) (HH:mm)? Lexicographic compare works for 24h. */
export function isNowInSlot(now: string, start: string, end: string): boolean {
  if (!now) return false;
  return now >= start && now < end;
}

/** Elapsed percentage (0–100) of a period, measured at `asOf`. */
export function periodProgress(startISO: string, endISO: string, asOfISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const now = new Date(asOfISO).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
