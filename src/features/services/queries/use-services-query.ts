import { useQuery } from "@tanstack/react-query";

import { getServices } from "../domain/use-cases";
import { servicesKeys } from "./keys";

/**
 * Fetches the service catalog with React Query.
 *
 * Returns the standard query result (`data`, `isPending`, `isError`, `error`,
 * `refetch`, …). Caching/staleness/retries come from the client defaults in
 * `@/shared/lib/query-client`.
 */
export function useServicesQuery() {
  return useQuery({
    queryKey: servicesKeys.lists(),
    queryFn: getServices,
  });
}
