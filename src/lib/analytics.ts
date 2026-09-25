/**
 * Privacy-conscious analytics. Events are logged to the console and queued
 * in memory only — no PII, no third-party network calls. A real pipeline
 * can replace the sink without touching call sites.
 */

export type AnalyticsEvent =
  | "app_opened"
  | "onboarding_completed"
  | "birth_profile_created"
  | "kundli_viewed"
  | "ai_question_asked"
  | "reading_listened"
  | "reading_rated"
  | "astrologer_viewed"
  | "consultation_started"
  | "consultation_completed"
  | "wallet_recharged"
  | "report_generated"
  | "report_downloaded";

const queue: { event: AnalyticsEvent; props?: Record<string, string | number | boolean>; at: string }[] = [];

export function trackEvent(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  const entry = { event, props, at: new Date().toISOString() };
  queue.push(entry);
  if (queue.length > 200) queue.shift();
  if (process.env.NODE_ENV === "development") {
    console.info("[analytics]", event, props ?? {});
  }
}

export function getQueuedEvents() {
  return [...queue];
}
