import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api-error";

const MAX_RETRIES = 2;

/**
 * Creates the app's React Query client with shared defaults.
 *
 * - `staleTime`: how long fetched data is considered fresh (no refetch).
 * - `gcTime`: how long unused data stays cached before garbage collection.
 * - `retry`: transient failures (network, 5xx) retry with backoff; 4xx and
 *   mapping bugs fail immediately — retrying them can't succeed.
 * - `refetchOnWindowFocus`: disabled — "window focus" isn't meaningful on native.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isRetriable) return false;
          return failureCount < MAX_RETRIES;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}
