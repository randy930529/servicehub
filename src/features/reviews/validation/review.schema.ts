import { z } from "zod";

/**
 * Single source of truth for the review form: runtime validation *and* the TS
 * type. Mirrors the server's rules so the user gets instant feedback, but the
 * API is the one that actually enforces them.
 */

export const MIN_STARS = 1;
export const MAX_STARS = 5;

export const ReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(MIN_STARS, "Elige una calificación")
    .max(MAX_STARS),
  /**
   * Optional, but not blank. An empty string is not a comment — the form sends
   * `null` instead, which is what "no comment" means to the API.
   */
  comment: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .refine((value) => value.length === 0 || value.length >= 3, {
      message: "Escribe al menos 3 caracteres",
    }),
});

export type ReviewForm = z.infer<typeof ReviewSchema>;
