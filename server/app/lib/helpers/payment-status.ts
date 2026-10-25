/**
 * Stripe's payment lifecycle, reduced to the states this product cares about.
 *
 * Pure: no Stripe client, no Mongo. Webhook delivery is the part that is hard
 * to reason about — events arrive late, twice, and occasionally out of order —
 * so the rules that decide what a given event may change live here, where
 * every combination can be enumerated in a test.
 */

export const PAYMENT_STATUSES = [
  /** Intent created, the customer has not paid yet. */
  "requires_payment",
  /** Authorized and settling. Common with 3-D Secure. */
  "processing",
  "succeeded",
  "failed",
  "canceled",
] as const;

export type PaymentStatusType = (typeof PAYMENT_STATUSES)[number];

/**
 * Once a payment reaches one of these, nothing a later webhook says should
 * move it. Money has either changed hands or definitively has not.
 */
const TERMINAL: PaymentStatusType[] = ["succeeded", "canceled"];

/**
 * Stripe's `PaymentIntent.status` → ours.
 *
 * Stripe distinguishes several "we need something from the customer" states
 * (`requires_payment_method`, `requires_confirmation`, `requires_action`).
 * They all mean the same thing to this app — nobody has paid yet — so they
 * collapse into one rather than leaking Stripe's vocabulary into our UI.
 */
export function mapStripeStatus(stripeStatus: string): PaymentStatusType {
  switch (stripeStatus) {
    case "succeeded":
      return "succeeded";
    case "processing":
      return "processing";
    case "canceled":
      return "canceled";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "requires_capture":
      return "requires_payment";
    default:
      // An unknown status from a future API version is not a failure — it just
      // is not something we can act on. Treating it as "failed" would tell a
      // customer their payment died when it may be fine.
      return "requires_payment";
  }
}

/**
 * Whether an incoming status should replace the stored one.
 *
 * Two things this guards against, both of which really happen:
 *
 *  - **Replays.** Stripe retries a webhook until it gets a 2xx, so the same
 *    event arrives more than once. Re-applying the same status is harmless,
 *    and returning `false` keeps the write out of the database.
 *  - **Out-of-order delivery.** Stripe does not guarantee ordering. A stale
 *    `payment_failed` arriving after `succeeded` must not un-pay an order.
 */
export function shouldApplyStatus(
  current: PaymentStatusType,
  next: PaymentStatusType,
): boolean {
  if (current === next) return false;
  if (TERMINAL.includes(current)) return false;

  // `failed` is not terminal: a customer can retry the same intent with
  // another card, and the next event legitimately moves it forward.
  if (current === "failed" && next === "requires_payment") return true;
  if (current === "failed") return next === "succeeded" || next === "processing";

  return true;
}

/** Events worth acting on. Anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.canceled",
] as const;

export type HandledEventType = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(type: string): type is HandledEventType {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}
