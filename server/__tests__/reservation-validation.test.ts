import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CreateReservationSchema,
  IDEMPOTENCY_HEADER,
  IdempotencyKeySchema,
  MAX_BOOKING_DAYS_AHEAD,
  parseIdempotencyKey,
  ReservationListFiltersSchema,
} from "@/app/lib/validation";

const SERVICE_ID = "6a7607b2caec07d0a2ab5383";

function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function requestWithKey(key: string | null): Request {
  return new Request("https://example.test/api/reservations", {
    method: "POST",
    headers: key === null ? {} : { [IDEMPOTENCY_HEADER]: key },
  });
}

describe("CreateReservationSchema", () => {
  it("accepts a future slot on a real service id", () => {
    const parsed = CreateReservationSchema.safeParse({
      serviceId: SERVICE_ID,
      scheduledFor: inDays(1),
    });

    assert.equal(parsed.success, true);
    assert.ok(parsed.data?.scheduledFor instanceof Date);
  });

  it("rejects a slot in the past", () => {
    const parsed = CreateReservationSchema.safeParse({
      serviceId: SERVICE_ID,
      scheduledFor: inDays(-1),
    });

    assert.equal(parsed.success, false);
  });

  it("rejects a slot absurdly far ahead", () => {
    // Not a business rule: a booking for the next century is a bug or an
    // attack, never a user.
    const parsed = CreateReservationSchema.safeParse({
      serviceId: SERVICE_ID,
      scheduledFor: inDays(MAX_BOOKING_DAYS_AHEAD + 1),
    });

    assert.equal(parsed.success, false);
  });

  it("rejects a date it cannot parse", () => {
    const parsed = CreateReservationSchema.safeParse({
      serviceId: SERVICE_ID,
      scheduledFor: "manana por la tarde",
    });

    assert.equal(parsed.success, false);
  });

  it("rejects an id that is not an ObjectId", () => {
    const parsed = CreateReservationSchema.safeParse({
      serviceId: "not-an-id",
      scheduledFor: inDays(1),
    });

    assert.equal(parsed.success, false);
  });

  it("keeps the offset the caller sent instead of guessing a timezone", () => {
    // Same instant, two notations. Both must land on the same Date.
    const utc = CreateReservationSchema.safeParse({
      serviceId: SERVICE_ID,
      scheduledFor: "2099-06-01T18:00:00Z",
    });
    const offset = CreateReservationSchema.safeParse({
      serviceId: SERVICE_ID,
      scheduledFor: "2099-06-01T12:00:00-06:00",
    });

    assert.equal(
      utc.data?.scheduledFor.getTime(),
      offset.data?.scheduledFor.getTime(),
    );
  });
});

describe("idempotency key", () => {
  it("accepts a UUID", () => {
    const parsed = IdempotencyKeySchema.safeParse(
      "7b1f1d1e-3f1a-4c4e-9f0e-2a2b3c4d5e6f",
    );

    assert.equal(parsed.success, true);
  });

  it("rejects one too short to be unique", () => {
    assert.equal(IdempotencyKeySchema.safeParse("abc").success, false);
  });

  it("rejects one long enough to be a payload", () => {
    assert.equal(IdempotencyKeySchema.safeParse("a".repeat(256)).success, false);
  });

  it("rejects whitespace, which would make two identical-looking keys differ", () => {
    assert.equal(
      IdempotencyKeySchema.safeParse("key with spaces").success,
      false,
    );
  });

  it("reads the header off a request", () => {
    const result = parseIdempotencyKey(requestWithKey("abcdefgh-1234"));

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.key, "abcdefgh-1234");
  });

  it("refuses a request without the header", () => {
    // Required on purpose: without a key a retry is indistinguishable from a
    // second booking, and "the client forgot" is exactly when that happens.
    const result = parseIdempotencyKey(requestWithKey(null));

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /Idempotency-Key/);
  });

  it("trims surrounding whitespace rather than rejecting it", () => {
    const result = parseIdempotencyKey(requestWithKey("  abcdefgh-1234  "));

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.key, "abcdefgh-1234");
  });
});

describe("ReservationListFiltersSchema", () => {
  it("defaults to the caller's own bookings", () => {
    const parsed = ReservationListFiltersSchema.parse({});

    assert.equal(parsed.role, "customer");
    assert.equal(parsed.status, undefined);
  });

  it("accepts the provider inbox", () => {
    assert.equal(
      ReservationListFiltersSchema.parse({ role: "provider" }).role,
      "provider",
    );
  });

  it("rejects a role that is not one of the two sides", () => {
    assert.equal(
      ReservationListFiltersSchema.safeParse({ role: "admin" }).success,
      false,
    );
  });

  it("rejects an unknown status instead of silently ignoring it", () => {
    assert.equal(
      ReservationListFiltersSchema.safeParse({ status: "refunded" }).success,
      false,
    );
  });
});
