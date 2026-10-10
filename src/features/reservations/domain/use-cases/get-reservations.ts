import { apiClient } from "@/shared/lib/api-client";

import type { Reservation, ReservationFilters } from "../types";
import {
  toReservation,
  toReservationQueryParams,
  type ApiReservationList,
} from "./api-reservation";

/**
 * The caller's reservations. Not paginated: a person's own bookings are a
 * short list, and paging it would add a cursor nobody scrolls.
 */
export async function getReservations(
  filters: ReservationFilters = {},
): Promise<Reservation[]> {
  const { data } = await apiClient.get<ApiReservationList>("/api/reservations", {
    params: toReservationQueryParams(filters),
  });

  return data.data.map(toReservation);
}
