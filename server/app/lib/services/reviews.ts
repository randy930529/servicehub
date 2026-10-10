import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { ZodSubmitHandler } from "@/app/lib/core";
import type {
  PublicReputationType,
  PublicReviewType,
} from "@/app/lib/definitions";
import { summarizeReputation } from "@/app/lib/helpers";
import {
  Reservation,
  Review,
  Service,
  type ReviewDocument,
} from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import {
  CreateReviewSchema,
  MAX_REVIEWS_PER_HOUR,
  RATE_LIMIT_WINDOW_MS,
  type CreateReviewInputType,
} from "@/app/lib/validation";

/** Mongo's duplicate-key error — here it means "already reviewed". */
const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY
  );
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

type ReviewSourceType = {
  _id: unknown;
  service: unknown;
  author?: unknown;
  rating: number;
  comment?: string | null;
  createdAt?: Date | string | null;
};

/**
 * Maps a stored review to the client shape.
 *
 * The author's id is dropped and only their display name survives: a review
 * list is public, and a user id is a handle for everything else they own.
 */
export function toPublicReview(source: ReviewSourceType): PublicReviewType {
  const author = source.author as { name?: string } | null | undefined;

  return {
    _id: String(source._id),
    serviceId: String(source.service),
    authorName:
      author && typeof author === "object" && author.name
        ? author.name
        : "Usuario",
    rating: source.rating,
    comment: source.comment ?? null,
    createdAt: toIsoString(source.createdAt),
  };
}

/**
 * Recomputes a service's stored reputation from its reviews.
 *
 * Recompute-on-write rather than incremental counters: an aggregate over one
 * service's reviews is a single indexed query, and a counter that drifts is
 * far more expensive to notice than this is to run.
 *
 * ponytail: full recompute per review. If a service ever accumulates enough
 * reviews for this to matter, switch to `$inc` on sum and count and derive the
 * score from those.
 */
export async function recomputeServiceReputation(
  serviceId: string,
): Promise<PublicReputationType> {
  const [totals] = await Review.aggregate<{ sum: number; count: number }>([
    { $match: { service: new Review.base.Types.ObjectId(serviceId) } },
    { $group: { _id: null, sum: { $sum: "$rating" }, count: { $sum: 1 } } },
  ]);

  const reputation = summarizeReputation(totals?.sum ?? 0, totals?.count ?? 0);

  await Service.findByIdAndUpdate(serviceId, {
    rating: reputation.score,
    ratingAverage: reputation.average,
    reviewCount: reputation.reviewCount,
  });

  return reputation;
}

/**
 * `POST /api/reviews` — rate a booking you actually had.
 *
 * The fraud story is mostly structural rather than heuristic: a review needs a
 * reservation, the reservation has to be yours, it has to have already
 * happened, and it can only be reviewed once. That removes the cheap attacks
 * without guessing at anyone's intent. The rate limit is the backstop.
 */
export class CreateReview extends ZodSubmitHandler<
  CreateReviewInputType,
  ReviewDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(Review, config);
  }

  protected schema(): ZodType<CreateReviewInputType> {
    return CreateReviewSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    const { reservationId, rating, comment } = parsed.data;

    await connectToDatabase();

    const reservation = await Reservation.findById(reservationId);

    // Not found and not-yours answer the same way: a 403 would confirm that
    // somebody else's reservation exists.
    if (!reservation || String(reservation.customer) !== auth.user.id) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Reservation not found" },
        404,
      );
    }

    if (reservation.status === "cancelled") {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Cannot review a cancelled reservation",
        },
        409,
      );
    }

    // The single most effective check here: you cannot rate something that has
    // not happened yet.
    if (reservation.scheduledFor.getTime() > Date.now()) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Cannot review a reservation that hasn't happened yet",
        },
        409,
      );
    }

    const recent = await Review.countDocuments({
      author: auth.user._id,
      createdAt: { $gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    });

    if (recent >= MAX_REVIEWS_PER_HOUR) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Too many reviews in a short time. Try again later.",
        },
        429,
      );
    }

    try {
      const review = await Review.create({
        reservation: reservation._id,
        service: reservation.service,
        author: auth.user._id,
        provider: reservation.provider,
        rating,
        comment: comment ?? null,
      });

      const reputation = await recomputeServiceReputation(
        String(reservation.service),
      );

      await review.populate("author", "name");

      return NextResponse.json(
        { review: toPublicReview(review), reputation },
        { status: 201 },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      // The unique index on `reservation` caught a second submit. Unlike a
      // reservation retry, this is not something to replay: the user is trying
      // to rate the same booking twice, and they should be told.
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "You already reviewed this reservation",
        },
        409,
      );
    }
  }
}

/**
 * `GET /api/reviews?serviceId=…` — a service's reviews, newest first.
 *
 * Public, like the catalog it belongs to: reviews that only logged-in users
 * can read are reviews nobody reads before deciding to sign up.
 */
export async function listServiceReviews(
  serviceId: string,
): Promise<PublicReviewType[] | null> {
  if (!isValidObjectId(serviceId)) return null;

  await connectToDatabase();

  const reviews = await Review.find({ service: serviceId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("author", "name")
    .lean();

  return reviews.map((item) =>
    toPublicReview(item as unknown as ReviewSourceType),
  );
}
