/**
 * MockPaymentProvider — DEMO ONLY. No real money moves, ever.
 *
 * Deterministic behaviour (so the demo is testable and honest):
 *  - createPayment returns a random hex gateway reference, status "created".
 *  - getStatus resolves by the reference's age: <1.2s "created", <6s
 *    "processing", then a deterministic terminal verdict.
 *  - Terminal verdict: the FIRST HEX CHARACTER of the payment id decides —
 *    "0" or "1" → declined. That is 2 of 16 possible hex chars ≈ 1 in 8
 *    (12.5%), close to the ~8% real-world decline rate.
 *
 * The ledger is in-memory (and survives dev hot reloads via globalThis); if an
 * id is unknown the provider still answers deterministically, so settlement
 * never depends on process memory.
 */

import { randomBytes } from "crypto";
import type { PaymentProvider, PaymentStatus } from "./types";

const PROVIDER_ID = "mock-gateway";
const PROVIDER_LABEL = "Demo payments (mock gateway)";

interface LedgerEntry {
  userId: string;
  amount: number;
  method: string;
  createdAt: number;
}

const globalForMock = globalThis as unknown as {
  __taraMockPayments?: Map<string, LedgerEntry>;
};
const ledger: Map<string, LedgerEntry> = globalForMock.__taraMockPayments ?? new Map();
globalForMock.__taraMockPayments = ledger;

/** Deterministic decline simulation: first hex char 0 or 1 → failed (≈1 in 8). */
export function mockDeclined(paymentId: string): boolean {
  return /^[01]/.test(paymentId);
}

function verdictFor(paymentId: string): PaymentStatus {
  return mockDeclined(paymentId) ? "failed" : "success";
}

export function getMockPaymentProvider(): PaymentProvider {
  return {
    id: PROVIDER_ID,
    label: PROVIDER_LABEL,
    mode: "mock",
    async createPayment(userId, amount, method) {
      const paymentId = randomBytes(12).toString("hex");
      ledger.set(paymentId, { userId, amount, method, createdAt: Date.now() });
      return { paymentId, status: "created" };
    },
    async getStatus(paymentId) {
      const entry = ledger.get(paymentId);
      const age = entry ? Date.now() - entry.createdAt : Number.POSITIVE_INFINITY;
      if (age < 1200) return { status: "created", gatewayRef: paymentId };
      if (age < 6000) return { status: "processing", gatewayRef: paymentId };
      return { status: verdictFor(paymentId), gatewayRef: paymentId };
    },
  };
}

export const MOCK_PAYMENT_PROVIDER_INFO = {
  id: PROVIDER_ID,
  mode: "mock" as const,
  label: PROVIDER_LABEL,
};
