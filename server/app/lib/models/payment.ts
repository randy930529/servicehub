import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

import { PAYMENT_STATUSES } from "@/app/lib/helpers/payment-status";

/**
 * A payment for one reservation.
 *
 * Deliberately mirrors, never replaces, Stripe's record: Stripe owns the
 * money, this owns the link between a PaymentIntent and the booking it pays
 * for. **No card data is stored, or ever reaches this server** — the mobile
 * SDK sends it straight to Stripe. See `docs/payments/pci.md`.
 */
const paymentSchema = new Schema(
  {
    /** One payment per reservation — see the unique index below. */
    reservation: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /**
     * What Stripe was asked to charge, in cents. Copied from the reservation
     * at intent time and **never** taken from the client: a request body is
     * the last place an amount should come from.
     */
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "mxn" },
    status: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: "requires_payment",
    },
    /** Stripe's id. The join key for every webhook that arrives later. */
    stripePaymentIntentId: { type: String, required: true },
    /**
     * Last failure Stripe reported, for the UI to show. A decline reason is
     * not sensitive, and hiding it leaves the customer guessing.
     */
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

/**
 * One payment per reservation. Enforced by the database for the same reason
 * as the idempotency key: two concurrent checkout taps would both pass a
 * read-then-write check and create two intents for one booking.
 */
paymentSchema.index({ reservation: 1 }, { unique: true });

/** Every webhook arrives knowing only the intent id; this is that lookup. */
paymentSchema.index({ stripePaymentIntentId: 1 }, { unique: true });

export type PaymentDocument = InferSchemaType<typeof paymentSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Payment: Model<PaymentDocument> =
  (models.Payment as Model<PaymentDocument>) ||
  model<PaymentDocument>("Payment", paymentSchema);
