import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CreateReviewSchema, MAX_REVIEWS_PER_HOUR } from "@/app/lib/validation";

const RESERVATION_ID = "771a2b3c4d5e6f7a8b9c0d1e";

function review(overrides: Record<string, unknown> = {}) {
  return CreateReviewSchema.safeParse({
    reservationId: RESERVATION_ID,
    rating: 5,
    ...overrides,
  });
}

describe("CreateReviewSchema", () => {
  it("accepts a bare rating with no comment", () => {
    // A star with no words is still a review.
    assert.equal(review().success, true);
  });

  it("accepts a rating with a comment", () => {
    assert.equal(review({ comment: "Excelente trabajo" }).success, true);
  });

  it("rejects ratings outside the scale", () => {
    assert.equal(review({ rating: 0 }).success, false);
    assert.equal(review({ rating: 6 }).success, false);
    assert.equal(review({ rating: -1 }).success, false);
  });

  it("rejects half stars, because the UI cannot produce them", () => {
    assert.equal(review({ rating: 4.5 }).success, false);
  });

  it("rejects a blank comment instead of storing it", () => {
    // An empty string would make "has a comment" lie to every reader.
    assert.equal(review({ comment: "   " }).success, false);
  });

  it("rejects a comment long enough to be an essay", () => {
    assert.equal(review({ comment: "a".repeat(1001) }).success, false);
  });

  it("allows an explicit null comment", () => {
    assert.equal(review({ comment: null }).success, true);
  });

  it("rejects a reservation id that is not an ObjectId", () => {
    assert.equal(review({ reservationId: "nope" }).success, false);
  });

  it("trims the comment rather than storing the padding", () => {
    const parsed = review({ comment: "  buen servicio  " });

    assert.equal(parsed.data?.comment, "buen servicio");
  });
});

describe("rate limit", () => {
  it("is generous enough for an honest catch-up session", () => {
    // The structural checks (yours, past, once) do the real work; this only
    // stops a scripted burst, so it must not punish a normal user.
    assert.ok(MAX_REVIEWS_PER_HOUR >= 3);
  });
});
