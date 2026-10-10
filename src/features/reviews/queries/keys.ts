/**
 * Query key factory for the reviews feature. Centralizing keys keeps cache
 * reads and invalidations consistent and typo-free.
 */
export const reviewsKeys = {
  all: ["reviews"] as const,
  lists: () => [...reviewsKeys.all, "list"] as const,
  byService: (serviceId: string) =>
    [...reviewsKeys.lists(), serviceId] as const,
};
