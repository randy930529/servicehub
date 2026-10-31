import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkRefundable,
  mapStripeStatus,
  planPaymentVoid,
  reconcilePayment,
  refundState,
} from "@/app/lib/helpers";

const paid = { amountCents: 30000, refundedCents: 0, status: "succeeded" };

describe("refundState", () => {
  it("is none when nothing came back", () => {
    assert.equal(refundState(30000, 0), "none");
  });

  it("is partial in between", () => {
    assert.equal(refundState(30000, 10000), "partial");
  });

  it("is full at exactly the charge", () => {
    assert.equal(refundState(30000, 30000), "full");
  });

  it("treats an over-refund as full, not as partial", () => {
    // Fees and rounding can settle a cent above. Calling that "partial" would
    // leave a payment looking permanently half-refunded.
    assert.equal(refundState(30000, 30001), "full");
  });
});

describe("planPaymentVoid", () => {
  it("refunds what is left of a charge that went through", () => {
    const plan = planPaymentVoid(paid);
    assert.deepEqual(plan, { action: "refund", amountCents: 30000 });
  });

  it("refunds only the remainder after a partial", () => {
    const plan = planPaymentVoid({ ...paid, refundedCents: 10000 });
    assert.deepEqual(plan, { action: "refund", amountCents: 20000 });
  });

  it("does nothing when it was already given back", () => {
    // A retry of the same cancellation must not issue a second refund.
    const plan = planPaymentVoid({ ...paid, refundedCents: 30000 });
    assert.deepEqual(plan, { action: "none" });
  });

  it("kills an intent nobody has paid yet", () => {
    // The dangerous one: left alive, the customer can still complete the
    // sheet and pay for a booking that no longer exists.
    assert.deepEqual(
      planPaymentVoid({ ...paid, status: "requires_payment" }),
      { action: "cancel_intent" },
    );
  });

  it("kills a failed intent too, since it can be retried", () => {
    assert.deepEqual(planPaymentVoid({ ...paid, status: "failed" }), {
      action: "cancel_intent",
    });
  });

  it("hands a processing payment to a person", () => {
    // Stripe refuses to cancel it and it may still succeed, so neither
    // action is possible yet — and silence here loses the customer's money.
    const plan = planPaymentVoid({ ...paid, status: "processing" });
    assert.equal(plan.action, "manual");
  });

  it("does nothing for an already-canceled payment", () => {
    assert.deepEqual(planPaymentVoid({ ...paid, status: "canceled" }), {
      action: "none",
    });
  });
});

describe("checkRefundable", () => {
  it("defaults to the whole remaining amount", () => {
    const r = checkRefundable(paid);
    assert.equal(r.ok && r.amountCents, 30000);
  });

  it("defaults to what is left after a partial", () => {
    const r = checkRefundable({ ...paid, refundedCents: 10000 });
    assert.equal(r.ok && r.amountCents, 20000);
  });

  it("accepts a valid partial", () => {
    const r = checkRefundable(paid, 5000);
    assert.equal(r.ok && r.amountCents, 5000);
  });

  it("refuses to refund more than remains", () => {
    // The one that actually loses money if it slips through.
    const r = checkRefundable({ ...paid, refundedCents: 25000 }, 10000);
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.message, /5000/);
  });

  it("refuses a payment that never succeeded", () => {
    for (const status of ["requires_payment", "processing", "failed", "canceled"]) {
      assert.equal(checkRefundable({ ...paid, status }).ok, false);
    }
  });

  it("refuses a payment already fully refunded", () => {
    assert.equal(checkRefundable({ ...paid, refundedCents: 30000 }).ok, false);
  });

  it("refuses zero, negatives and fractions of a cent", () => {
    for (const amount of [0, -100, 10.5]) {
      assert.equal(checkRefundable(paid, amount).ok, false);
    }
  });
});

describe("reconcilePayment", () => {
  const base = {
    paymentId: "p1",
    status: "succeeded",
    amountCents: 30000,
    refundedCents: 0,
  };

  it("reports nothing when both sides agree", () => {
    const d = reconcilePayment(
      { ...base, stripe: { status: "succeeded", amountCents: 30000, refundedCents: 0 } },
      mapStripeStatus,
    );
    assert.deepEqual(d, []);
  });

  it("flags a payment Stripe has never heard of", () => {
    // The worst case: we think we charged somebody and Stripe disagrees.
    const d = reconcilePayment({ ...base, stripe: null }, mapStripeStatus);
    assert.equal(d.length, 1);
    assert.equal(d[0].kind, "missing_in_stripe");
  });

  it("flags status drift", () => {
    const d = reconcilePayment(
      { ...base, status: "processing", stripe: { status: "succeeded", amountCents: 30000, refundedCents: 0 } },
      mapStripeStatus,
    );
    assert.equal(d[0].kind, "status_drift");
    assert.equal(d[0].theirs, "succeeded");
  });

  it("flags a refund we never recorded", () => {
    const d = reconcilePayment(
      { ...base, stripe: { status: "succeeded", amountCents: 30000, refundedCents: 15000 } },
      mapStripeStatus,
    );
    assert.equal(d[0].kind, "refund_drift");
  });

  it("reports every drift at once rather than the first", () => {
    const d = reconcilePayment(
      { ...base, status: "processing", stripe: { status: "succeeded", amountCents: 29000, refundedCents: 500 } },
      mapStripeStatus,
    );
    assert.deepEqual(d.map((x) => x.kind).sort(), [
      "amount_drift",
      "refund_drift",
      "status_drift",
    ]);
  });

  it("does not flag Stripe's richer vocabulary as drift", () => {
    // `requires_payment_method` maps onto our `requires_payment`; calling that
    // a discrepancy would bury real findings in noise.
    const d = reconcilePayment(
      { ...base, status: "requires_payment", stripe: { status: "requires_payment_method", amountCents: 30000, refundedCents: 0 } },
      mapStripeStatus,
    );
    assert.deepEqual(d, []);
  });
});
