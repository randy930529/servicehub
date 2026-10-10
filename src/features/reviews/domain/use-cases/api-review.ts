import type { Reputation, Review } from "../types";

/** A review as returned by the backend (Mongo `_id`). */
export interface ApiReview {
  _id: string;
  serviceId: string;
  authorName: string;
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
}

export interface ApiReviewList {
  data: ApiReview[];
}

export interface ApiReviewResponse {
  review: ApiReview;
  reputation: Reputation;
}

/** Maps the API shape (`_id`) to the domain `Review` (`id`). */
export function toReview(api: ApiReview): Review {
  return {
    id: api._id,
    serviceId: api.serviceId,
    authorName: api.authorName,
    rating: api.rating,
    comment: api.comment ?? null,
    createdAt: api.createdAt ?? null,
  };
}
