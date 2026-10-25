import { NextResponse } from "next/server";

import { applyStripeEvent } from "@/app/lib/services";
import { getStripe, getStripeWebhookSecret } from "@/app/lib/payments/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/webhooks/stripe:
 *   post:
 *     summary: Stripe webhook receiver
 *     description: >
 *       Not called by the app — Stripe calls it. Every request is verified
 *       against the signing secret before anything is read from it: an
 *       unverified webhook is just a stranger claiming somebody paid.
 *       Idempotent, because Stripe retries until it gets a 2xx and does not
 *       guarantee ordering.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event acknowledged (handled or deliberately ignored).
 *       400:
 *         description: Signature missing, malformed, or not ours.
 *       503:
 *         description: Payments are not configured on this server.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = getStripeWebhookSecret();

  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // The **raw** body, byte for byte. `request.json()` would reorder or
  // reformat nothing visible, but the signature covers the exact bytes Stripe
  // sent, so parsing first breaks verification.
  const raw = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    // Deliberately terse: a detailed rejection tells a forger what to fix.
    console.error("Stripe webhook signature rejected", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const outcome = await applyStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    // 500 so Stripe retries: the event was genuine and we failed to store it,
    // which is exactly the case retries exist for.
    console.error("Stripe webhook handling failed", error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
