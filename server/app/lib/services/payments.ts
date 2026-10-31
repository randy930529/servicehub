import { isValidObjectId } from "mongoose";
import type Stripe from "stripe";

import type { PublicPaymentType } from "@/app/lib/definitions";
import {
  isHandledEvent,
  mapStripeStatus,
  planPaymentVoid,
  REFUND_EVENTS,
  refundState,
  shouldApplyStatus,
  type PaymentStatusType,
} from "@/app/lib/helpers";
import {
  Payment,
  Reservation,
  WebhookEvent,
  type PaymentDocument,
} from "@/app/lib/models";
import { applyRefundToPayment, refundPayment } from "./refunds";
import { connectToDatabase } from "@/app/lib/mongoose";
import {
  getStripe,
  getStripePublishableKey,
  PAYMENT_CURRENCY,
} from "@/app/lib/payments/stripe-client";

/** Statuses whose Stripe intent can still be paid, so it is worth reusing. */
const REUSABLE: PaymentStatusType[] = [
  "requires_payment",
  "processing",
  "failed",
];

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function toPublicPayment(source: {
  _id: unknown;
  reservation: unknown;
  amountCents: number;
  currency: string;
  status: PaymentStatusType;
  lastError?: string | null;
  refundedCents?: number;
  createdAt?: Date | string | null;
}): PublicPaymentType {
  const refundedCents = source.refundedCents ?? 0;

  return {
    _id: String(source._id),
    reservationId: String(source.reservation),
    amountCents: source.amountCents,
    currency: source.currency,
    status: source.status,
    lastError: source.lastError ?? null,
    refundedCents,
    refundState: refundState(source.amountCents, refundedCents),
    createdAt: toIsoString(source.createdAt),
  };
}

export type CheckoutResultType =
  | {
      ok: true;
      clientSecret: string;
      publishableKey: string;
      payment: PublicPaymentType;
    }
  | { ok: false; status: number; message: string };

/**
 * `POST /api/payments/intent` — prepares a payment for one reservation.
 *
 * The amount is read from the reservation, **never** from the request body.
 * An amount a client can choose is an amount a client can set to 1 cent, and
 * no amount of validation elsewhere makes that safe.
 *
 * Returns Stripe's `client_secret`, which is what the mobile SDK needs to
 * collect a card and confirm the payment without the card ever touching this
 * server.
 */
export async function createPaymentIntent(
  reservationId: string,
  userId: string,
): Promise<CheckoutResultType> {
  const stripe = getStripe();
  const publishableKey = getStripePublishableKey();

  if (!stripe || !publishableKey) {
    return {
      ok: false,
      status: 503,
      message: "Payments are not configured on this server",
    };
  }

  if (!isValidObjectId(reservationId)) {
    return { ok: false, status: 404, message: "Reservation not found" };
  }

  await connectToDatabase();

  const reservation = await Reservation.findById(reservationId);

  // Not found and not-yours answer alike: a 403 would confirm it exists.
  if (!reservation || String(reservation.customer) !== userId) {
    return { ok: false, status: 404, message: "Reservation not found" };
  }

  if (reservation.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      message: "Cannot pay for a cancelled reservation",
    };
  }

  const existing = await Payment.findOne({ reservation: reservation._id });

  if (existing) {
    if (existing.status === "succeeded") {
      return { ok: false, status: 409, message: "This reservation is paid" };
    }

    if (REUSABLE.includes(existing.status as PaymentStatusType)) {
      // Reuse rather than create a second intent: two live intents for one
      // booking is how a customer ends up charged twice.
      const intent = await stripe.paymentIntents.retrieve(
        existing.stripePaymentIntentId,
      );

      if (intent.client_secret) {
        return {
          ok: true,
          clientSecret: intent.client_secret,
          publishableKey,
          payment: toPublicPayment(existing),
        };
      }
    }
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: reservation.priceAtBookingCents,
      currency: PAYMENT_CURRENCY,
      // Lets the webhook find the booking without a lookup table, and makes
      // the Stripe dashboard readable when something goes wrong at 3am.
      metadata: {
        reservationId: String(reservation._id),
        customerId: userId,
      },
      automatic_payment_methods: { enabled: true },
    },
    // Stripe's own idempotency: a retried request returns the same intent
    // instead of creating a second one.
    { idempotencyKey: `reservation:${String(reservation._id)}` },
  );

  const payment = await Payment.findOneAndUpdate(
    { reservation: reservation._id },
    {
      reservation: reservation._id,
      customer: reservation.customer,
      provider: reservation.provider,
      amountCents: reservation.priceAtBookingCents,
      currency: PAYMENT_CURRENCY,
      status: mapStripeStatus(intent.status),
      stripePaymentIntentId: intent.id,
      lastError: null,
    },
    { upsert: true, new: true },
  );

  return {
    ok: true,
    clientSecret: intent.client_secret ?? "",
    publishableKey,
    payment: toPublicPayment(payment as PaymentDocument & { _id: unknown }),
  };
}

export type WebhookOutcomeType =
  | {
      handled: true;
      changed: boolean;
      status?: PaymentStatusType;
      /** True when this exact event had already been processed. */
      duplicate?: boolean;
    }
  | { handled: false; reason: string };

/**
 * Applies a verified Stripe event.
 *
 * Assumes the signature was already checked — this function trusts its input,
 * and the route is what earns that trust.
 *
 * Idempotent by construction: Stripe retries until it gets a 2xx, and does
 * not guarantee ordering, so a repeat or a stale event must leave the record
 * alone rather than rewrite history. `shouldApplyStatus` owns that rule.
 */
export async function applyStripeEvent(
  event: Stripe.Event,
): Promise<WebhookOutcomeType> {
  await connectToDatabase();

  // Event-id dedupe, before anything else. Week 15 deduped by *status*, which
  // works for a state machine and breaks for anything cumulative: two partial
  // refunds are two legitimate events, and a replay of one would be counted
  // twice. Stripe keeps the event id stable across retries, so "have I seen
  // this exact event?" is the only question that works for every type.
  //
  // The insert is the check: two retries arriving at once would both pass a
  // read-then-write, and the loser of the unique index is the one that must
  // do nothing.
  try {
    await WebhookEvent.create({
      stripeEventId: event.id,
      type: event.type,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return { handled: true, changed: false, duplicate: true };
    }
    throw error;
  }

  let outcome: WebhookOutcomeType;

  try {
    outcome = await dispatchStripeEvent(event);
  } catch (error) {
    // The marker must not outlive the work it claims to have done. Stripe
    // retries a 5xx, and with the row still there the retry would be
    // deduplicated into a no-op — the event lost for good. That was survivable
    // while handling an event only moved a status; it is not now that one can
    // issue a refund.
    await WebhookEvent.deleteOne({ stripeEventId: event.id });
    throw error;
  }

  await WebhookEvent.updateOne(
    { stripeEventId: event.id },
    { outcome: JSON.stringify(outcome).slice(0, 200) },
  );

  return outcome;
}

/** Routes a verified, not-yet-seen event to whatever should act on it. */
async function dispatchStripeEvent(
  event: Stripe.Event,
): Promise<WebhookOutcomeType> {
  if ((REFUND_EVENTS as readonly string[]).includes(event.type)) {
    return applyRefundEvent(event);
  }

  if (!isHandledEvent(event.type)) {
    // Acknowledged, not acted on. Returning an error would make Stripe retry
    // an event we will never care about, forever.
    return { handled: false, reason: `Unhandled event ${event.type}` };
  }

  const intent = event.data.object as Stripe.PaymentIntent;

  const payment = await Payment.findOne({ stripePaymentIntentId: intent.id });

  if (!payment) {
    // Can happen legitimately: an intent created by another environment
    // pointing at the same webhook URL. Not an error worth retrying.
    return { handled: false, reason: "No payment for that intent" };
  }

  const next = mapStripeStatus(intent.status);

  if (!shouldApplyStatus(payment.status as PaymentStatusType, next)) {
    return {
      handled: true,
      changed: false,
      status: payment.status as PaymentStatusType,
    };
  }

  payment.status = next;
  payment.lastError =
    next === "failed"
      ? (intent.last_payment_error?.message ?? "Payment failed")
      : null;

  await payment.save();

  if (next === "succeeded") {
    await settleReservationForPayment(payment);
  }

  return { handled: true, changed: true, status: next };
}

/**
 * Closes the loop between a payment and the booking it paid for.
 *
 * Until now the two were only linked by an id: a reservation could sit at
 * `pending` with the money already taken, which is the kind of gap that gets
 * noticed by the person who shows up and is told they never confirmed.
 *
 * The cancelled branch is the race worth naming: the customer cancels while
 * the payment sheet is open, the charge lands anyway, and we end up holding
 * money for a booking that no longer exists. Giving it back is the only
 * honest answer, and it is a *deterministic* rule — not reconciliation
 * guessing, which is why this one is allowed to move money on its own.
 */
async function settleReservationForPayment(
  payment: PaymentDocument & { _id: unknown },
): Promise<void> {
  const reservation = await Reservation.findById(payment.reservation);
  if (!reservation) return;

  if (reservation.status === "pending") {
    reservation.status = "confirmed";
    await reservation.save();
    return;
  }

  if (reservation.status === "cancelled") {
    const result = await refundPayment(String(payment._id));

    if (!result.ok) {
      // Logged, not thrown: retrying the webhook would not change the answer,
      // and `GET /api/payments/reconcile` is what surfaces it afterwards.
      console.error(
        `Paid a cancelled reservation ${String(reservation._id)} and could not refund it: ${result.message}`,
      );
    }
  }
}

export type VoidPaymentOutcomeType =
  | { action: "none" }
  | { action: "refunded"; amountCents: number }
  | { action: "canceled_intent" }
  | { action: "manual"; reason: string };

/**
 * Undoes whatever a cancelled booking's payment was doing.
 *
 * **Never throws.** It is called after the cancellation is already saved, and
 * a booking must not stay alive — holding an hour nobody can book — because
 * Stripe had a bad minute. Anything that cannot be done here comes back as
 * `manual` and is picked up by reconciliation.
 */
export async function voidPaymentForReservation(
  reservationId: string,
): Promise<VoidPaymentOutcomeType> {
  try {
    await connectToDatabase();

    const payment = await Payment.findOne({ reservation: reservationId });
    if (!payment) return { action: "none" };

    const stripe = getStripe();
    if (!stripe) {
      return { action: "manual", reason: "Payments are not configured" };
    }

    const plan = planPaymentVoid({
      status: payment.status,
      amountCents: payment.amountCents,
      refundedCents: payment.refundedCents,
    });

    if (plan.action === "refund") {
      const result = await refundPayment(String(payment._id));
      return result.ok
        ? { action: "refunded", amountCents: result.amountCents }
        : { action: "manual", reason: result.message };
    }

    if (plan.action === "cancel_intent") {
      await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      // Written here as well as by the webhook, like a refund is: whoever
      // cancelled should see the result now, and the event-id dedupe makes
      // the webhook's copy a no-op.
      payment.status = "canceled";
      await payment.save();
      return { action: "canceled_intent" };
    }

    return plan.action === "manual"
      ? { action: "manual", reason: plan.reason }
      : { action: "none" };
  } catch (error) {
    console.error(
      `Could not void the payment for reservation ${reservationId}`,
      error,
    );
    return {
      action: "manual",
      reason: "Could not reach Stripe; check the payment by hand",
    };
  }
}

/**
 * Refund events. `charge.refunded` carries the charge (with its refund list);
 * `refund.*` carry the refund itself. Both end up in the same place.
 */
async function applyRefundEvent(
  event: Stripe.Event,
): Promise<WebhookOutcomeType> {
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const intentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!intentId) {
      return { handled: false, reason: "Charge has no payment intent" };
    }

    let changed = false;
    for (const refund of charge.refunds?.data ?? []) {
      // `||=` not `=`: one applied refund out of several still counts.
      changed = (await applyRefundToPayment(intentId, refund)) || changed;
    }

    return { handled: true, changed };
  }

  const refund = event.data.object as Stripe.Refund;
  const intentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;

  if (!intentId) {
    return { handled: false, reason: "Refund has no payment intent" };
  }

  const changed = await applyRefundToPayment(intentId, refund);
  return { handled: true, changed };
}

/** `GET /api/payments?reservationId=…` — the caller's payment for a booking. */
export async function getPaymentForReservation(
  reservationId: string,
  userId: string,
): Promise<PublicPaymentType | null> {
  if (!isValidObjectId(reservationId)) return null;

  await connectToDatabase();

  const payment = await Payment.findOne({
    reservation: reservationId,
    customer: userId,
  });

  return payment ? toPublicPayment(payment) : null;
}

/**
 * `GET /api/payments/history` — every payment the caller made, newest first.
 *
 * Scoped to the authenticated customer. Not paginated: a person's own
 * payments are a short list, and a cursor nobody scrolls is dead weight.
 */
export async function listPaymentHistory(
  userId: string,
): Promise<PublicPaymentType[]> {
  await connectToDatabase();

  const payments = await Payment.find({ customer: userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return payments.map((p) =>
    toPublicPayment(p as unknown as Parameters<typeof toPublicPayment>[0]),
  );
}
