import { apiClient } from "@/shared/lib/api-client";

import type { Review, ReviewInput } from "../types";
import { toReview, type ApiReviewResponse } from "./api-review";

/**
 * Rates a booking.
 *
 * No idempotency key here, unlike a reservation: the API enforces one review
 * per reservation with a unique index, and a repeat is a mistake worth telling
 * the user about rather than a retry to absorb silently.
 */
export async function createReview(input: ReviewInput): Promise<Review> {
  const { data } = await apiClient.post<ApiReviewResponse>(
    "/api/reviews",
    input,
  );

  return toReview(data.review);
}
