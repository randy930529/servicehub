import { z } from "zod";

import { SERVICE_CATEGORIES } from "@/app/lib/models";
import {
  getServiceImageMaxBytes,
  isAllowedServiceImageContentType,
} from "@/app/lib/storage";

/**
 * Server-side validation for the service CRUD endpoints.
 *
 * The app mirrors these rules with its own Zod schemas for instant feedback,
 * but the API can never trust that: these are the ones protecting the database.
 */

export const SERVICE_NAME_MIN = 3;
export const SERVICE_NAME_MAX = 80;
export const SERVICE_DESCRIPTION_MIN = 20;
export const SERVICE_DESCRIPTION_MAX = 600;
export const SERVICE_PROVIDER_MIN = 2;
export const SERVICE_PROVIDER_MAX = 60;

/** 1,000,000 MXN in cents — a ceiling that catches a misplaced decimal. */
export const SERVICE_PRICE_MAX_CENTS = 100_000_000;

/** Human order (lat, lng); converted to GeoJSON `[lng, lat]` when persisted. */
export const ServiceLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type ServiceLocationInputType = z.infer<typeof ServiceLocationSchema>;

const serviceFields = {
  name: z.string().trim().min(SERVICE_NAME_MIN).max(SERVICE_NAME_MAX),
  description: z
    .string()
    .trim()
    .min(SERVICE_DESCRIPTION_MIN)
    .max(SERVICE_DESCRIPTION_MAX),
  category: z.enum(SERVICE_CATEGORIES),
  /** Cents, never a float: money in JS floats rounds wrong eventually. */
  priceFromCents: z.number().int().min(0).max(SERVICE_PRICE_MAX_CENTS),
  /**
   * Optional: defaults to the owner's own name. Present so a provider can trade
   * under a business name without renaming their account.
   */
  providerName: z
    .string()
    .trim()
    .min(SERVICE_PROVIDER_MIN)
    .max(SERVICE_PROVIDER_MAX)
    .optional(),
  /** Key of an already-uploaded image; `null` clears the current one. */
  imageKey: z.string().trim().min(1).max(256).nullable().optional(),
  /** `null` removes the location, so the service drops out of radius search. */
  location: ServiceLocationSchema.nullable().optional(),
};

/** `POST /api/services`. */
export const CreateServiceSchema = z.object(serviceFields);

export type CreateServiceInputType = z.infer<typeof CreateServiceSchema>;

/**
 * `PATCH /api/services/:id` — every field optional (partial update), but the
 * body must change at least one thing.
 */
export const UpdateServiceSchema = z
  .object(serviceFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type UpdateServiceInputType = z.infer<typeof UpdateServiceSchema>;

/**
 * `POST /api/services/image/upload-url`. The declared `size` is a cheap
 * pre-check so an oversized file is rejected before it's uploaded; the real
 * enforcement happens on confirm, against the object actually stored.
 *
 * Built lazily (a function, not a constant) because the limit comes from env.
 */
export function buildServiceImageUploadRequestSchema() {
  const maxBytes = getServiceImageMaxBytes();

  return z.object({
    contentType: z.string().refine(isAllowedServiceImageContentType, {
      message: "Unsupported image type. Use JPEG, PNG or WebP",
    }),
    size: z
      .number()
      .int()
      .positive()
      .max(maxBytes, { message: `Image is larger than ${maxBytes} bytes` }),
  });
}

export type ServiceImageUploadRequestInputType = z.infer<
  ReturnType<typeof buildServiceImageUploadRequestSchema>
>;
