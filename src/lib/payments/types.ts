/**
 * PaymentProvider — the normalized payment abstraction (mirrors the
 * AstrologyProvider pattern). The app must always go through this module;
 * never import a concrete gateway directly (AGENTS.md §2).
 *
 * Today: mock (demo, no real money). Tomorrow: a real gateway (Razorpay,
 * PayU…) implements the same interface with zero UI changes.
 *
 * Security rule (AGENTS.md §2.9): the CLIENT never reports payment success —
 * settlement is always computed and persisted server-side.
 */

export type PaymentMethod = "upi" | "card" | "netbanking";

export type PaymentStatus = "created" | "processing" | "success" | "failed" | "refunded";

export interface PaymentCreation {
  /** Provider-side reference for the created payment attempt. */
  paymentId: string;
  status: PaymentStatus;
}

export interface PaymentStatusInfo {
  status: PaymentStatus;
  gatewayRef?: string;
}

export interface PaymentCreateOptions {
  /** DEMO ONLY — force this attempt to end "failed" (deterministic decline). */
  forceFail?: boolean;
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** "mock" for demo gateways, "live" for real money. */
  readonly mode: "mock" | "live";
  createPayment(
    userId: string,
    amount: number,
    method: PaymentMethod,
    options?: PaymentCreateOptions
  ): Promise<PaymentCreation>;
  getStatus(paymentId: string): Promise<PaymentStatusInfo>;
}

export interface PaymentProviderInfo {
  id: string;
  mode: "mock" | "live";
  label: string;
}
