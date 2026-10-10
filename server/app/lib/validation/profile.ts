import { z } from "zod";

import { getAvatarMaxBytes, isAllowedAvatarContentType } from "@/app/lib/storage";

/**
 * Server-side validation for the profile endpoints.
 *
 * The app validates the same rules with its own Zod schemas for instant
 * feedback, but the API can never trust that: these schemas are the ones that
 * actually protect the database.
 */

/** Phone numbers vary too much per country to parse — only shape is checked. */
const PHONE_PATTERN = /^[+]?[\d\s()-]{7,20}$/;

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const BIO_MAX = 280;

/**
 * `PATCH /api/users/me` — every field optional (partial update), but the body
 * must change at least one thing. Empty strings are allowed for `bio`/`phone`
 * so a user can clear them.
 */
/**
 * A provider's weekly schedule. `endHour` is exclusive, and the refinement is
 * what stops a "schedule" that can never produce a slot — the API would
 * otherwise accept 18→9 and silently publish nothing.
 */
export const WorkingHoursSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    /** 0 = Sunday. Deduplicated so [1,1,2] cannot inflate anything later. */
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  })
  .refine((hours) => hours.endHour > hours.startHour, {
    message: "End hour must be after start hour",
    path: ["endHour"],
  });

export const UpdateProfileSchema = z
  .object({
    workingHours: WorkingHoursSchema,
    name: z.string().trim().min(NAME_MIN).max(NAME_MAX),
    bio: z.string().trim().max(BIO_MAX),
    phone: z
      .string()
      .trim()
      .refine((value) => value === "" || PHONE_PATTERN.test(value), {
        message: "Invalid phone number",
      }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateProfileInputType = z.infer<typeof UpdateProfileSchema>;

/**
 * `POST /api/users/me/avatar/upload-url`. The declared `size` is a cheap
 * pre-check so an oversized file is rejected before it's uploaded; the real
 * enforcement happens on confirm, against the object actually stored.
 *
 * Built lazily (a function, not a constant) because the size limit is read
 * from the environment.
 */
export function buildAvatarUploadRequestSchema() {
  const maxBytes = getAvatarMaxBytes();

  return z.object({
    contentType: z
      .string()
      .refine(isAllowedAvatarContentType, {
        message: "Unsupported image type. Use JPEG, PNG or WebP",
      }),
    size: z
      .number()
      .int()
      .positive()
      .max(maxBytes, { message: `Image is larger than ${maxBytes} bytes` }),
  });
}

export type AvatarUploadRequestInputType = z.infer<
  ReturnType<typeof buildAvatarUploadRequestSchema>
>;

/**
 * `PUT /api/users/me/avatar` — the client reports which key it uploaded to.
 * Ownership of that key is verified separately (`isOwnedAvatarKey`); this only
 * checks the shape.
 */
export const AvatarConfirmSchema = z.object({
  key: z.string().trim().min(1).max(256),
});

export type AvatarConfirmInputType = z.infer<typeof AvatarConfirmSchema>;
