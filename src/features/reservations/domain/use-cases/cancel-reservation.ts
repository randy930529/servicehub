import { apiClient } from "@/shared/lib/api-client";

import type { Reservation } from "../types";
import { toReservation, type ApiReservationResponse } from "./api-reservation";

/**
 * Cancels a booking, from either side.
 *
 * No idempotency key needed: cancelling twice leaves the same state, so the
 * endpoint is naturally safe to retry.
 */
export async function cancelReservation(id: string): Promise<Reservation> {
  const { data } = await apiClient.post<ApiReservationResponse>(
    `/api/reservations/${id}/cancel`,
  );

  return toReservation(data.reservation);
}
