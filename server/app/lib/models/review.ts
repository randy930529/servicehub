import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

import { MAX_RATING, MIN_RATING } from "@/app/lib/helpers/reputation";

/**
 * A review of a service, written by the customer of one reservation.
 *
 * Anchored to a reservation rather than to a (customer, service) pair: that is
 * what makes "you can only review what you actually booked" enforceable, and
 * it lets the same customer review a repeat booking of the same service
 * without the second one overwriting the first.
 */
const reviewSchema = new Schema(
  {
    /** The booking being reviewed. One review each — see the index below. */
    reservation: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    /** Who wrote it. Always the reservation's customer. */
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Denormalized like the reservation's, so a provider's reviews are one query. */
    provider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: {
      type: Number,
      required: true,
      min: MIN_RATING,
      max: MAX_RATING,
    },
    /** Optional: a star with no words is still a review. */
    comment: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

/**
 * One review per reservation, enforced by the database rather than by a
 * read-then-write check — the same reasoning as the reservation idempotency
 * key: two concurrent submits would both pass a `findOne`.
 */
reviewSchema.index({ reservation: 1 }, { unique: true });

/** Listing a service's reviews, newest first. */
reviewSchema.index({ service: 1, createdAt: -1 });

/** Rate limiting counts an author's recent reviews; this is that query. */
reviewSchema.index({ author: 1, createdAt: -1 });

export type ReviewDocument = InferSchemaType<typeof reviewSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Review: Model<ReviewDocument> =
  (models.Review as Model<ReviewDocument>) ||
  model<ReviewDocument>("Review", reviewSchema);
