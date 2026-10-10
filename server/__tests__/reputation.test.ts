import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bayesianScore,
  plainAverage,
  PRIOR_MEAN,
  PRIOR_WEIGHT,
  summarizeReputation,
} from "@/app/lib/helpers";

describe("plainAverage", () => {
  it("is the mean you would expect", () => {
    assert.equal(plainAverage(15, 3), 5);
    assert.equal(plainAverage(9, 2), 4.5);
  });

  it("is zero with no reviews, not NaN", () => {
    assert.equal(plainAverage(0, 0), 0);
  });
});

describe("bayesianScore", () => {
  it("is zero with no reviews", () => {
    assert.equal(bayesianScore(0, 0), 0);
  });

  it("barely moves on a single review", () => {
    // The attack this exists to stop: one 5-star review from a friend must not
    // outrank an established service.
    const newcomer = bayesianScore(5, 1);

    assert.ok(newcomer < 4.3, `expected a modest score, got ${newcomer}`);
    assert.ok(newcomer > PRIOR_MEAN, "a 5-star review should still help");
  });

  it("ranks fifty good reviews above one perfect one", () => {
    const oneFiveStar = bayesianScore(5, 1);
    const fiftyAt48 = bayesianScore(4.8 * 50, 50);

    assert.ok(
      fiftyAt48 > oneFiveStar,
      `${fiftyAt48} should beat ${oneFiveStar}`,
    );
  });

  it("converges on the real average once reviews pile up", () => {
    const score = bayesianScore(4.6 * 500, 500);

    assert.ok(Math.abs(score - 4.6) < 0.01, `got ${score}`);
  });

  it("pulls a single bad review up toward the prior, not down to it", () => {
    // Symmetry check: shrinkage must protect against one unfair 1-star the
    // same way it protects against one friendly 5-star.
    const score = bayesianScore(1, 1);

    assert.ok(score > 1, "one bad review should not define a service");
    assert.ok(score < PRIOR_MEAN, "but it should still hurt");
  });

  it("sits exactly between prior and reviews at equal weight", () => {
    // With PRIOR_WEIGHT reviews, the prior and the reviews weigh the same.
    const allFives = bayesianScore(5 * PRIOR_WEIGHT, PRIOR_WEIGHT);
    const midpoint = (PRIOR_MEAN + 5) / 2;

    assert.ok(Math.abs(allFives - midpoint) < 0.01, `got ${allFives}`);
  });

  it("never leaves the 0–5 scale", () => {
    for (const [sum, count] of [
      [5 * 1000, 1000],
      [1 * 1000, 1000],
      [0, 0],
      [3, 1],
    ]) {
      const score = bayesianScore(sum, count);
      assert.ok(score >= 0 && score <= 5, `${score} out of range`);
    }
  });
});

describe("summarizeReputation", () => {
  it("reports the honest average alongside the ranking score", () => {
    const summary = summarizeReputation(10, 2);

    // Both reviews said 5, so that is what a screen must show...
    assert.equal(summary.average, 5);
    // ...while the ranking stays sceptical of two data points.
    assert.ok(summary.score < summary.average);
    assert.equal(summary.reviewCount, 2);
  });

  it("is all zeros for a service nobody reviewed", () => {
    assert.deepEqual(summarizeReputation(0, 0), {
      score: 0,
      average: 0,
      reviewCount: 0,
    });
  });

  it("never reports a negative count", () => {
    assert.equal(summarizeReputation(0, -3).reviewCount, 0);
  });
});
