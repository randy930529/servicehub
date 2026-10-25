import { isValidObjectId } from "mongoose";
import type Stripe from "stripe";

import type { PublicPaymentType } from "@/app/lib/definitions";
import {
  isHandledEvent,
  mapStripeStatus,
  shouldApplyStatus,
  type PaymentStatusType,
} from "@/app/lib/helpers";
import { Payment, Reservation, type PaymentDocument } from "@/app/lib/models";
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
  createdAt?: Date | string | null;
}): PublicPaymentType {
  return {
    _id: String(source._id),
    reservationId: String(source.reservation),
    amountCents: source.amountCents,
    currency: source.currency,
    status: source.status,
    lastError: source.lastError ?? null,
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
  | { handled: true; changed: boolean; status?: PaymentStatusType }
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
  if (!isHandledEvent(event.type)) {
    // Acknowledged, not acted on. Returning an error would make Stripe retry
    // an event we will never care about, forever.
    return { handled: false, reason: `Unhandled event ${event.type}` };
  }

  const intent = event.data.object as Stripe.PaymentIntent;

  await connectToDatabase();

  const payment = await Payment.findOne({ stripePaymentIntentId: intent.id });

  if (!payment) {
    // Can happen legitimately: an intent created by another environment
    // pointing at the same webhook URL. Not an error worth retrying.
    return { handled: false, reason: "No payment for that intent" };
  }

  const next = mapStripeStatus(intent.status);

  if (!shouldApplyStatus(payment.status as PaymentStatusType, next)) {
    return { handled: true, changed: false, status: payment.status as PaymentStatusType };
  }

  payment.status = next;
  payment.lastError =
    next === "failed"
      ? (intent.last_payment_error?.message ?? "Payment failed")
      : null;

  await payment.save();

  return { handled: true, changed: true, status: next };
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
