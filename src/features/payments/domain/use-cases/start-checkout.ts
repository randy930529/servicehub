import { apiClient } from "@/shared/lib/api-client";

import type { CheckoutSession } from "../types";
import { toCheckoutSession, type ApiCheckoutResponse } from "./api-payment";

/**
 * Asks the API to prepare a payment for a reservation.
 *
 * Sends only the reservation id. The amount is the server's business: an
 * amount the client can send is an amount the client can set to one cent.
 *
 * Safe to call twice — the API reuses the existing intent rather than
 * creating a second one, which is what stops a double tap from becoming a
 * double charge.
 */
export async function startCheckout(
  reservationId: string,
): Promise<CheckoutSession> {
  const { data } = await apiClient.post<ApiCheckoutResponse>(
    "/api/payments/intent",
    { reservationId },
  );

  return toCheckoutSession(data);
}
