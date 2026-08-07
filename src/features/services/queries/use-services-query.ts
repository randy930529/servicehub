import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { getServices } from "../domain/use-cases";
import type { ServiceFilters } from "../domain/types";
import { servicesKeys } from "./keys";

/**
 * Fetches the service catalog, page by page, for the active filters.
 *
 * `select` flattens the pages so screens see a plain list and never touch
 * React Query's page bookkeeping. `keepPreviousData` is what makes the search
 * box feel instant: while a new query is in flight the previous results stay on
 * screen instead of collapsing into a spinner on every keystroke.
 *
 * Caching/staleness/retries come from the client defaults in
 * `@/shared/lib/query-client`.
 */
export function useServicesQuery(filters: ServiceFilters = {}) {
  return useInfiniteQuery({
    queryKey: servicesKeys.list(filters),
    queryFn: ({ pageParam }) => getServices(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    placeholderData: keepPreviousData,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items),
      total: data.pages[0]?.total ?? 0,
    }),
  });
}
