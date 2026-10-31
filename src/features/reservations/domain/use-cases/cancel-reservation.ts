import { apiClient } from "@/shared/lib/api-client";

import type { CancelResult } from "../types";
import { toReservation, type ApiCancelResponse } from "./api-reservation";

/**
 * Cancels a booking, from either side.
 *
 * No idempotency key needed: cancelling twice leaves the same state, so the
 * endpoint is naturally safe to retry — and a retry is also how a refund that
 * could not be issued the first time gets a second chance.
 *
 * Returns what happened to the money as well as the booking: a silent refund
 * is almost as unsettling as none at all.
 */
export async function cancelReservation(id: string): Promise<CancelResult> {
  const { data } = await apiClient.post<ApiCancelResponse>(
    `/api/reservations/${id}/cancel`,
  );

  return {
    reservation: toReservation(data.reservation),
    // A server from before refunds-on-cancel simply says nothing.
    payment: data.payment ?? { action: "none" },
  };
}
