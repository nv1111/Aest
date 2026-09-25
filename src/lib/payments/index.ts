/**
 * PaymentProvider factory. The app must always go through this module —
 * never import a concrete gateway directly (AGENTS.md §2).
 *
 * Today: mock (demo). Tomorrow: swap MOCK for a verified live gateway; the UI
 * won't know the difference because everything is typed to PaymentProvider.
 */

import type { PaymentProvider, PaymentProviderInfo } from "./types";
import { getMockPaymentProvider, MOCK_PAYMENT_PROVIDER_INFO } from "./mock-provider";

export * from "./types";
export { MOCK_PAYMENT_PROVIDER_INFO, mockDeclined } from "./mock-provider";

export function getPaymentProvider(): PaymentProvider {
  // Architecture-ready: read an env flag (e.g. PAYMENT_PROVIDER=live) and
  // return the real gateway once it is integrated and PCI-compliant.
  return getMockPaymentProvider();
}

export function getPaymentProviderInfo(): PaymentProviderInfo {
  return MOCK_PAYMENT_PROVIDER_INFO;
}
