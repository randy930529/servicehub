import { z } from "zod";

import { MAX_RATING, MIN_RATING } from "@/app/lib/helpers/reputation";

/**
 * Server-side validation for the review endpoints.
 *
 * The app mirrors these rules for instant feedback, but the API can never
 * trust that: these are the ones protecting the database.
 */

/**
 * How many reviews one author may write per hour.
 *
 * The real brake on fake reviews is structural — you can only review a booking
 * you made and that already happened — so this is the second line, against
 * someone with a pile of stale reservations trying to burn through them in one
 * scripted burst. Generous enough that an honest catch-up session never hits
 * it.
 */
export const MAX_REVIEWS_PER_HOUR = 5;

export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const objectIdField = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Not a valid id");

/** `POST /api/reviews`. */
export const CreateReviewSchema = z.object({
  reservationId: objectIdField,
  rating: z
    .number()
    .int("Rating must be a whole number of stars")
    .min(MIN_RATING, `Rating must be at least ${MIN_RATING}`)
    .max(MAX_RATING, `Rating must be at most ${MAX_RATING}`),
  /**
   * Optional, but if present it has to say something. A blank string is not a
   * comment — storing it would make "has a comment" lie to every reader.
   */
  comment: z
    .string()
    .trim()
    .min(3, "Comment is too short")
    .max(1000, "Comment is too long")
    .nullable()
    .optional(),
});

export type CreateReviewInputType = z.infer<typeof CreateReviewSchema>;
