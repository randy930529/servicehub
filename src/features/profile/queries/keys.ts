/**
 * Query key factory for the profile feature. Centralizing keys keeps cache
 * reads, invalidations and prefetching consistent and typo-free.
 */
export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
};
