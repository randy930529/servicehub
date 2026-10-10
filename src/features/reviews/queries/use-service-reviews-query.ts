import { useQuery } from "@tanstack/react-query";

import { getServiceReviews } from "../domain/use-cases";
import { reviewsKeys } from "./keys";

/** A service's reviews. Disabled without an id, like the service query. */
export function useServiceReviewsQuery(serviceId: string | undefined) {
  return useQuery({
    queryKey: reviewsKeys.byService(serviceId ?? ""),
    queryFn: () => getServiceReviews(serviceId as string),
    enabled: Boolean(serviceId),
  });
}
