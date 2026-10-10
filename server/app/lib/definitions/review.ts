/** A review as sent to clients. */
export type PublicReviewType = {
  _id: string;
  serviceId: string;
  /** Display name of whoever wrote it. The author's id never leaves. */
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string | null;
};

/** A service's reputation, as sent to clients. */
export type PublicReputationType = {
  /** Ranking score (Bayesian). What the catalog sorts by. */
  score: number;
  /** Plain mean of the reviews — the number to show. */
  average: number;
  reviewCount: number;
};
