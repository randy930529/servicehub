import type { ServiceFilters } from "../domain/types";

/**
 * Query key factory for the services feature. Centralizing keys keeps cache
 * reads, invalidations and prefetching consistent and typo-free.
 */

/**
 * Filters normalized into a stable, fully-specified object.
 *
 * Without this, `{}` and `{ q: "" }` would be different cache entries for the
 * same result, and key order would depend on how the caller built the object.
 */
function filtersKey(filters: ServiceFilters) {
  return {
    q: filters.q?.trim() ?? "",
    category: filters.category ?? null,
    sort: filters.sort ?? null,
    mineOnly: filters.mineOnly ?? false,
    near: filters.near
      ? {
          lat: filters.near.lat,
          lng: filters.near.lng,
          radiusKm: filters.near.radiusKm,
        }
      : null,
  };
}

export const servicesKeys = {
  all: ["services"] as const,
  lists: () => [...servicesKeys.all, "list"] as const,
  list: (filters: ServiceFilters = {}) =>
    [...servicesKeys.lists(), filtersKey(filters)] as const,
  details: () => [...servicesKeys.all, "detail"] as const,
  detail: (id: string) => [...servicesKeys.details(), id] as const,
};
