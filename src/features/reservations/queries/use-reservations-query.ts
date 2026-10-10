import { useQuery } from "@tanstack/react-query";

import type { ReservationFilters } from "../domain/types";
import { getReservations } from "../domain/use-cases";
import { reservationsKeys } from "./keys";

/** The caller's bookings, as customer (default) or as provider. */
export function useReservationsQuery(filters: ReservationFilters = {}) {
  return useQuery({
    queryKey: reservationsKeys.list(filters),
    queryFn: () => getReservations(filters),
  });
}
