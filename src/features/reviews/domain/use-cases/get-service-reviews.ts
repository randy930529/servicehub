import { apiClient } from "@/shared/lib/api-client";

import type { Review } from "../types";
import { toReview, type ApiReviewList } from "./api-review";

/** A service's reviews, newest first. Public — no session needed. */
export async function getServiceReviews(serviceId: string): Promise<Review[]> {
  const { data } = await apiClient.get<ApiReviewList>("/api/reviews", {
    params: { serviceId },
  });

  return data.data.map(toReview);
}
