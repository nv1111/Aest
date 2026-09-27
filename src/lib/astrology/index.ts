/**
 * AstrologyProvider factory. The app must always go through this module —
 * never import a concrete engine directly (AGENTS.md §2).
 *
 * ASTROLOGY_PROVIDER=live (default) → real ephemeris (astronomy-engine,
 *   VSOP87-grade, Lahiri ayanamsa).
 * ASTROLOGY_PROVIDER=mock → deterministic demo engine.
 */

import type { AstrologyProvider, ProviderInfo } from "./types";
import { getMockAstrologyProvider, MOCK_PROVIDER_INFO } from "./mock/provider";
import { getLiveAstrologyProvider, LIVE_PROVIDER_INFO } from "./live/provider";

export * from "./types";
export { MOCK_PROVIDER_INFO } from "./mock/provider";
export { LIVE_PROVIDER_INFO } from "./live/provider";

export function getAstrologyProvider(): AstrologyProvider {
  const mode = (process.env.ASTROLOGY_PROVIDER ?? "live").toLowerCase();
  if (mode === "mock") return getMockAstrologyProvider();
  return getLiveAstrologyProvider();
}

export function getProviderInfo(): ProviderInfo {
  const mode = (process.env.ASTROLOGY_PROVIDER ?? "live").toLowerCase();
  return mode === "mock" ? MOCK_PROVIDER_INFO : LIVE_PROVIDER_INFO;
}
