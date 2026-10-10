import type { ReservationFilters } from "../domain/types";

/**
 * Query key factory for the reservations feature. Centralizing keys keeps
 * cache reads and invalidations consistent and typo-free.
 */

/**
 * Filters normalized into a stable, fully-specified object, so `{}` and
 * `{ role: "customer" }` — the same request — share one cache entry instead of
 * two.
 */
function filtersKey(filters: ReservationFilters) {
  return {
    role: filters.role ?? "customer",
    status: filters.status ?? null,
  };
}

export const reservationsKeys = {
  all: ["reservations"] as const,
  lists: () => [...reservationsKeys.all, "list"] as const,
  list: (filters: ReservationFilters = {}) =>
    [...reservationsKeys.lists(), filtersKey(filters)] as const,
  availability: (serviceId: string) =>
    [...reservationsKeys.all, "availability", serviceId] as const,
};
