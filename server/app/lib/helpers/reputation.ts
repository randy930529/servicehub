/**
 * How a pile of reviews becomes one number.
 *
 * Pure arithmetic, no Mongo: the ranking rule is the part worth testing
 * exhaustively, and it should be readable without a database in the room.
 */

/** Rating bounds. The UI offers whole stars; the API enforces the range. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/**
 * Prior mean — what we assume about a service we know nothing about.
 *
 * Deliberately below the midpoint of the scale but not pessimistic: people who
 * bother to review a service they chose tend to rate it well, so 4.0 is closer
 * to a real "unremarkable" than 3.0 would be.
 */
export const PRIOR_MEAN = 4;

/**
 * How much the prior weighs, in units of reviews.
 *
 * A service needs roughly this many reviews of its own before its average
 * stops being pulled toward the prior. Five is enough to blunt the attack
 * below without burying a genuinely good newcomer for months.
 */
export const PRIOR_WEIGHT = 5;

export type ReputationType = {
  /** Ranking score, 0–5. What the catalog sorts by. */
  score: number;
  /** Plain mean of the actual reviews, 0–5. What a profile should display. */
  average: number;
  reviewCount: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Bayesian average: the reviews a service has, plus `PRIOR_WEIGHT` imaginary
 * ones at `PRIOR_MEAN`.
 *
 * A plain mean is the obvious choice and the wrong one here, because the
 * catalog can sort by rating: one 5★ review from a friend would put a brand
 * new service above one with fifty 4.8★. That is not a hypothetical edge case,
 * it is the cheapest way to game a marketplace — which is why this lives in
 * the same week as the rest of the fraud checks.
 *
 * Shrinking toward a prior makes a single review worth little and a hundred
 * reviews worth almost exactly their own average.
 */
export function bayesianScore(sum: number, count: number): number {
  if (count <= 0) return 0;

  return round2(
    (PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + count),
  );
}

/** Plain mean — honest to display, too naive to rank by. */
export function plainAverage(sum: number, count: number): number {
  if (count <= 0) return 0;
  return round2(sum / count);
}

/**
 * Both numbers at once, because callers almost always want the pair: the score
 * goes to the sort field, the average goes on screen. Showing the score to a
 * user would be confusing — "4.4" when every single review said 5 looks like a
 * bug, not a ranking.
 */
export function summarizeReputation(
  sum: number,
  count: number,
): ReputationType {
  return {
    score: bayesianScore(sum, count),
    average: plainAverage(sum, count),
    reviewCount: Math.max(0, count),
  };
}
