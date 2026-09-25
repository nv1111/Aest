/**
 * AstrologyProvider factory. The app must always go through this module —
 * never import a concrete engine directly (AGENTS.md §2).
 *
 * Today: mock (demo). Tomorrow: swap MOCK for a verified engine; the UI won't
 * know the difference because everything is typed to AstrologyProvider.
 */

import type { AstrologyProvider, ProviderInfo } from "./types";
import { getMockAstrologyProvider, MOCK_PROVIDER_INFO } from "./mock/provider";

export * from "./types";
export { MOCK_PROVIDER_INFO } from "./mock/provider";

export function getAstrologyProvider(): AstrologyProvider {
  // Architecture-ready: read an env flag (e.g. ASTROLOGY_PROVIDER=live) and
  // return the real engine once it is integrated and verified.
  return getMockAstrologyProvider();
}

export function getProviderInfo(): ProviderInfo {
  return MOCK_PROVIDER_INFO;
}
