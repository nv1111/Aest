import { http } from "@/lib/http";
import type { WalletTransactionDTO } from "@/types/models";

export type RechargeMethod = "upi" | "card" | "netbanking";

export interface PaymentDTO {
  id: string;
  amount: number;
  status: string;
  method?: string;
  failureReason?: string | null;
}

export interface PaymentStateDTO {
  payment: PaymentDTO;
  balance?: number;
}

/** walletService — money display only; every mutation is server-side. */
export const walletService = {
  transactions: (limit = 50) =>
    http.get<{ transactions: WalletTransactionDTO[] }>(`/api/wallet/transactions?limit=${limit}`),

  recharge: (amount: number, method: RechargeMethod) =>
    http.post<{ payment: PaymentDTO }>("/api/wallet/recharge", { amount, method }),

  payment: (id: string) => http.get<PaymentStateDTO>(`/api/payments/${id}`),
};
