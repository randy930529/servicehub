import { useQuery } from "@tanstack/react-query";

import { getAvailability } from "../domain/use-cases";
import { reservationsKeys } from "./keys";

/**
 * A service's free slots.
 *
 * `staleTime: 0` on purpose, against the app-wide 5-minute default:
 * availability is the one thing here that another user can invalidate at any
 * moment, and an hour that looks free but is not wastes the whole booking
 * flow before failing.
 */
export function useAvailabilityQuery(serviceId: string | undefined) {
  return useQuery({
    queryKey: reservationsKeys.availability(serviceId ?? ""),
    queryFn: () => getAvailability(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 0,
  });
}
