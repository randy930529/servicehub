import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * Lifecycle of a booking.
 *
 * `confirmed` has no endpoint yet — the provider side lands in part 2 — but it
 * is in the enum because the flow this models is client → provider, and a
 * status a reservation can never reach is a smaller lie than one the domain
 * needs and the schema rejects.
 */
export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

const reservationSchema = new Schema(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    /** Who booked it. */
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /**
     * Who has to show up. Copied from `service.owner` at booking time rather
     * than joined on read: a service can change hands, and the reservation
     * belongs to the person who agreed to it, not to whoever owns the listing
     * later. It also makes "reservations for me as a provider" one indexed
     * query instead of a lookup through services.
     */
    provider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Start of the booked slot, in UTC. */
    scheduledFor: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: RESERVATION_STATUSES,
      default: "pending",
    },
    /**
     * What the service cost when it was booked, in MXN cents.
     *
     * Snapshot, not a join: the provider can raise the price tomorrow and the
     * customer still agreed to today's. Reading it live would silently rewrite
     * history on every list.
     */
    priceAtBookingCents: { type: Number, required: true, min: 0 },
    /**
     * The `Idempotency-Key` the client sent. Required: a create without one
     * cannot be replayed safely, and a nullable unique index would need a
     * partial filter to allow more than one missing value.
     */
    idempotencyKey: { type: String, required: true, trim: true },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/**
 * The idempotency guarantee itself.
 *
 * Scoped to the customer so two people cannot collide on the same key, and
 * **unique** so the database is the arbiter. A read-then-write check would let
 * two concurrent retries both pass the read; here the second insert fails with
 * a duplicate-key error and the handler returns the first reservation.
 */
reservationSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });

/** "Mis reservas", newest slot first. */
reservationSchema.index({ customer: 1, scheduledFor: -1 });

/** "Reservas de mis servicios", the provider's inbox. */
reservationSchema.index({ provider: 1, scheduledFor: -1 });

export type ReservationDocument = InferSchemaType<typeof reservationSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Reservation: Model<ReservationDocument> =
  (models.Reservation as Model<ReservationDocument>) ||
  model<ReservationDocument>("Reservation", reservationSchema);
