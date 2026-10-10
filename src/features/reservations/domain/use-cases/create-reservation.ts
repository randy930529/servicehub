import { apiClient } from "@/shared/lib/api-client";

import type { Reservation, ReservationInput } from "../types";
import { toReservation, type ApiReservationResponse } from "./api-reservation";

/** Header the API requires to make this call replayable. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/**
 * Books a slot.
 *
 * The idempotency key travels as a header, not in the body: it describes the
 * *request*, not the reservation, and the API answers a repeat of the same key
 * with the booking it already made (200) instead of a second one (201). The
 * caller cannot tell the two apart, and should not need to — either way it
 * ends up with the one reservation that exists.
 */
export async function createReservation(
  input: ReservationInput,
): Promise<Reservation> {
  const { idempotencyKey, ...body } = input;

  const { data } = await apiClient.post<ApiReservationResponse>(
    "/api/reservations",
    body,
    { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } },
  );

  return toReservation(data.reservation);
}
