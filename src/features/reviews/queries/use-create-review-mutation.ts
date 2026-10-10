import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ReviewInput } from "../domain/types";
import { createReview } from "../domain/use-cases";
import { reviewsKeys } from "./keys";

/**
 * Rates a booking.
 *
 * Invalidates both the review lists *and* the services cache: a new review
 * moves the service's stored rating, so a catalog still showing the old score
 * would be wrong the moment this succeeds.
 *
 * Fire-and-forget, like the other features' invalidators: awaiting it would
 * keep the submit button spinning until every list had refetched.
 */
export function useCreateReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewInput) => createReview(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsKeys.lists() });
      // Key prefix rather than an import from the services feature: features
      // may not depend on each other, and a cache key is not an API.
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}
