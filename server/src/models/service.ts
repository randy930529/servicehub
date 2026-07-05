import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * Service categories — kept in sync with the mobile app's domain type
 * (`src/features/services/domain/types.ts`).
 */
export const SERVICE_CATEGORIES = [
  "hogar",
  "belleza",
  "tecnologia",
  "bienestar",
  "automotriz",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: SERVICE_CATEGORIES },
    /** Starting price in MXN cents (integer, avoids float rounding). */
    priceFromCents: { type: Number, required: true, min: 0 },
    /** Average rating, 0–5. */
    rating: { type: Number, required: true, min: 0, max: 5 },
    providerName: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export type ServiceDocument = InferSchemaType<typeof serviceSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Service: Model<ServiceDocument> =
  (models.Service as Model<ServiceDocument>) ||
  model<ServiceDocument>("Service", serviceSchema);
