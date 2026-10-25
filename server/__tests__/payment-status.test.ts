import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HANDLED_EVENTS,
  isHandledEvent,
  mapStripeStatus,
  shouldApplyStatus,
} from "@/app/lib/helpers";

describe("mapStripeStatus", () => {
  it("passes the states we share with Stripe straight through", () => {
    assert.equal(mapStripeStatus("succeeded"), "succeeded");
    assert.equal(mapStripeStatus("processing"), "processing");
    assert.equal(mapStripeStatus("canceled"), "canceled");
  });

  it("collapses every 'we need something from the customer' state", () => {
    // Stripe's vocabulary here is richer than the UI needs; all three mean
    // "nobody has paid yet".
    for (const status of [
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
      "requires_capture",
    ]) {
      assert.equal(mapStripeStatus(status), "requires_payment");
    }
  });

  it("treats an unknown status as pending, not as failure", () => {
    // A status from a future API version is not something we can act on.
    // Calling it "failed" would tell a customer their payment died when it
    // may be perfectly fine.
    assert.equal(mapStripeStatus("some_future_status"), "requires_payment");
  });
});

describe("shouldApplyStatus", () => {
  it("ignores a repeat of the same status", () => {
    // Stripe retries until it gets a 2xx, so the same event arrives twice.
    assert.equal(shouldApplyStatus("succeeded", "succeeded"), false);
    assert.equal(shouldApplyStatus("processing", "processing"), false);
  });

  it("never un-pays a successful payment", () => {
    // The one that matters: Stripe does not guarantee ordering, so a stale
    // `payment_failed` can land after `succeeded`.
    assert.equal(shouldApplyStatus("succeeded", "failed"), false);
    assert.equal(shouldApplyStatus("succeeded", "requires_payment"), false);
    assert.equal(shouldApplyStatus("succeeded", "processing"), false);
  });

  it("never reopens a cancelled payment", () => {
    assert.equal(shouldApplyStatus("canceled", "succeeded"), false);
    assert.equal(shouldApplyStatus("canceled", "requires_payment"), false);
  });

  it("moves forward through the normal lifecycle", () => {
    assert.equal(shouldApplyStatus("requires_payment", "processing"), true);
    assert.equal(shouldApplyStatus("requires_payment", "succeeded"), true);
    assert.equal(shouldApplyStatus("processing", "succeeded"), true);
    assert.equal(shouldApplyStatus("processing", "failed"), true);
  });

  it("lets a failed payment be retried with another card", () => {
    // `failed` is not terminal: the same intent can be confirmed again.
    assert.equal(shouldApplyStatus("failed", "requires_payment"), true);
    assert.equal(shouldApplyStatus("failed", "processing"), true);
    assert.equal(shouldApplyStatus("failed", "succeeded"), true);
  });

  it("does not let a failed payment drift sideways into cancelled", () => {
    assert.equal(shouldApplyStatus("failed", "canceled"), false);
  });
});

describe("isHandledEvent", () => {
  it("accepts the payment_intent events we act on", () => {
    for (const type of HANDLED_EVENTS) {
      assert.equal(isHandledEvent(type), true);
    }
  });

  it("rejects everything else", () => {
    // Unhandled events are acknowledged, not errored: a 4xx would make Stripe
    // retry an event we will never care about, forever.
    assert.equal(isHandledEvent("charge.refunded"), false);
    assert.equal(isHandledEvent("customer.created"), false);
    assert.equal(isHandledEvent(""), false);
  });
});
