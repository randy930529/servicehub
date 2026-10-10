import { describe, expect, test } from "@jest/globals";

import { ReviewSchema } from "@/features/reviews/validation/review.schema";

function parse(overrides: Record<string, unknown> = {}) {
  return ReviewSchema.safeParse({ rating: 5, comment: "", ...overrides });
}

describe("ReviewSchema", () => {
  test("accepts stars with no comment", () => {
    expect(parse().success).toBe(true);
  });

  test("requires a rating, so an accidental submit cannot post zero stars", () => {
    const result = parse({ rating: 0 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Elige una calificación");
  });

  test("rejects more than five stars", () => {
    expect(parse({ rating: 6 }).success).toBe(false);
  });

  test("accepts a real comment", () => {
    expect(parse({ comment: "Muy buen servicio" }).success).toBe(true);
  });

  test("rejects a comment too short to say anything", () => {
    expect(parse({ comment: "ok" }).success).toBe(false);
  });

  test("still accepts an empty comment — blank means 'no comment'", () => {
    // The distinction matters: "" is absence, "ok" is an attempt that failed.
    expect(parse({ comment: "   " }).success).toBe(true);
  });

  test("rejects an essay", () => {
    expect(parse({ comment: "a".repeat(1001) }).success).toBe(false);
  });
});
