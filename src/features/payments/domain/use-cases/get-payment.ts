import { apiClient } from "@/shared/lib/api-client";

import type { Payment } from "../types";
import { toPayment, type ApiPaymentResponse } from "./api-payment";

/**
 * The caller's payment for a reservation, or `null` if they never started one.
 *
 * This is how the app learns a payment settled: the webhook updates the
 * record server-side, and the app reads it back. The SDK's own result only
 * says the card was accepted, not that the charge cleared.
 */
export async function getPayment(reservationId: string): Promise<Payment | null> {
  const { data } = await apiClient.get<ApiPaymentResponse>("/api/payments", {
    params: { reservationId },
  });

  return data.payment ? toPayment(data.payment) : null;
}
