/**
 * Query key factory for the services feature. Centralizing keys keeps cache
 * reads, invalidations and prefetching consistent and typo-free.
 */
export const servicesKeys = {
  all: ["services"] as const,
  lists: () => [...servicesKeys.all, "list"] as const,
  detail: (id: string) => [...servicesKeys.all, "detail", id] as const,
};
