import { apiClient } from "@/shared/lib/api-client";

import type { Reservation } from "../types";
import { toReservation, type ApiReservationResponse } from "./api-reservation";

/**
 * The provider accepts a booking.
 *
 * Idempotent server-side, so a retry from a flaky connection is safe and
 * needs no key.
 */
export async function confirmReservation(id: string): Promise<Reservation> {
  const { data } = await apiClient.post<ApiReservationResponse>(
    `/api/reservations/${id}/confirm`,
  );

  return toReservation(data.reservation);
}
