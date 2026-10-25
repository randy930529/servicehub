import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import Stripe from "stripe";

/**
 * Signature verification, exercised against Stripe's real implementation.
 *
 * No network and no mock of `constructEvent`: the signatures below are built
 * the way Stripe builds them, so these tests fail if the library changes its
 * rules — which is the only thing worth testing here. Mocking the verifier
 * would test that a mock returns what it was told to.
 */

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests_only";
const stripe = new Stripe("sk_test_unused_by_signature_checks");

function paymentIntentEvent(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_test_1",
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_1",
        object: "payment_intent",
        status: "succeeded",
        amount: 45000,
        currency: "mxn",
        ...overrides,
      },
    },
  });
}

/** Builds the `Stripe-Signature` header the way Stripe does. */
function sign(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

describe("webhook signature verification", () => {
  it("accepts a correctly signed payload", () => {
    const payload = paymentIntentEvent();
    const header = sign(payload, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));

    const event = stripe.webhooks.constructEvent(
      payload,
      header,
      WEBHOOK_SECRET,
    );

    assert.equal(event.type, "payment_intent.succeeded");
    assert.equal((event.data.object as { id: string }).id, "pi_test_1");
  });

  it("rejects a payload signed with the wrong secret", () => {
    // The attack this stops: anyone can POST "somebody paid" to a public URL.
    const payload = paymentIntentEvent();
    const header = sign(payload, "whsec_not_our_secret", Math.floor(Date.now() / 1000));

    assert.throws(() =>
      stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET),
    );
  });

  it("rejects a payload altered after signing", () => {
    // Signing a 1-cent charge and editing the amount upward, or editing a
    // failed payment into a successful one.
    const original = paymentIntentEvent({ amount: 100 });
    const header = sign(original, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const tampered = original.replace('"amount":100', '"amount":4500000');

    assert.throws(() =>
      stripe.webhooks.constructEvent(tampered, header, WEBHOOK_SECRET),
    );
  });

  it("rejects an old signature, so a captured request cannot be replayed", () => {
    const payload = paymentIntentEvent();
    const longAgo = Math.floor(Date.now() / 1000) - 60 * 60;
    const header = sign(payload, WEBHOOK_SECRET, longAgo);

    assert.throws(() =>
      stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET),
    );
  });

  it("still accepts an old signature when the tolerance allows it", () => {
    // Proof that the previous rejection was about age, not about the payload.
    const payload = paymentIntentEvent();
    const longAgo = Math.floor(Date.now() / 1000) - 60 * 60;
    const header = sign(payload, WEBHOOK_SECRET, longAgo);

    const event = stripe.webhooks.constructEvent(
      payload,
      header,
      WEBHOOK_SECRET,
      60 * 60 * 24,
    );

    assert.equal(event.type, "payment_intent.succeeded");
  });

  it("rejects a header with no v1 signature at all", () => {
    const payload = paymentIntentEvent();

    assert.throws(() =>
      stripe.webhooks.constructEvent(
        payload,
        `t=${Math.floor(Date.now() / 1000)}`,
        WEBHOOK_SECRET,
      ),
    );
  });

  it("verifies against the exact bytes, so re-serializing breaks it", () => {
    // Why the route reads `request.text()` and not `request.json()`: the
    // signature covers the bytes Stripe sent, and `JSON.stringify(parsed)`
    // is not guaranteed to reproduce them.
    const payload = paymentIntentEvent();
    const header = sign(payload, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const reSerialized = JSON.stringify(JSON.parse(payload), null, 2);

    assert.throws(() =>
      stripe.webhooks.constructEvent(reSerialized, header, WEBHOOK_SECRET),
    );
  });
});
