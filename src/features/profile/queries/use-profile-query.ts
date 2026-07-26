import { useQuery } from "@tanstack/react-query";

import { getProfile } from "../domain/use-cases";
import { profileKeys } from "./keys";

/**
 * Fetches the authenticated user's profile.
 *
 * Caching/staleness/retries come from the client defaults in
 * `@/shared/lib/query-client`.
 */
export function useProfileQuery() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: getProfile,
  });
}
