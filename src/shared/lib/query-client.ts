import { QueryClient } from "@tanstack/react-query";

/**
 * Creates the app's React Query client with shared defaults.
 *
 * - `staleTime`: how long fetched data is considered fresh (no refetch).
 * - `gcTime`: how long unused data stays cached before garbage collection.
 * - `retry`: failed queries retry a couple of times (React Query backs off).
 * - `refetchOnWindowFocus`: disabled — "window focus" isn't meaningful on native.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}
