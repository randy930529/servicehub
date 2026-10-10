/**
 * Reviews domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer.
 * No React, no UI, no persistence concerns here.
 */

export interface Review {
  id: string;
  serviceId: string;
  /** Display name of whoever wrote it. Author ids never reach the client. */
  authorName: string;
  /** Whole stars, 1–5. */
  rating: number;
  comment: string | null;
  createdAt: string | null;
}

/**
 * A service's reputation.
 *
 * Two numbers on purpose: `score` is the Bayesian value the catalog ranks by,
 * `average` is the plain mean. Show the average — a 4.4 when every review said
 * 5 reads as a bug.
 */
export interface Reputation {
  score: number;
  average: number;
  reviewCount: number;
}

/** What the app sends to rate a booking. */
export interface ReviewInput {
  reservationId: string;
  rating: number;
  comment?: string | null;
}
