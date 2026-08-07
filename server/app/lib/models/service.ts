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

/**
 * GeoJSON point, the only shape MongoDB's `2dsphere` index understands.
 * Coordinates are `[longitude, latitude]` — GeoJSON order, the reverse of how
 * humans (and `expo-location`) say it, which is the classic bug here.
 */
const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) =>
          value.length === 2 &&
          value[0] >= -180 &&
          value[0] <= 180 &&
          value[1] >= -90 &&
          value[1] <= 90,
        message: "coordinates must be [longitude, latitude] within range",
      },
    },
  },
  { _id: false },
);

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
    /**
     * Who may edit or delete this service. Nullable because the seeded catalog
     * predates ownership: those documents belong to nobody, so the ownership
     * guard fails closed and no user can edit them.
     */
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /**
     * Object key of the photo inside the service-images bucket. The public URL
     * is derived at read time, exactly like avatars.
     */
    imageKey: { type: String, default: null },
    /** Where the service is offered. Optional: not every service is on a map. */
    location: { type: pointSchema, default: null },
  },
  { timestamps: true },
);

/**
 * Indexes. Every one of these backs a query the catalog actually runs — an
 * unused index is pure write cost.
 */

// Full-text search over `q`. Spanish stemming and stop words, because the
// catalog copy is Spanish ("limpieza de hogar" must match "limpiar hogar").
// `name` outweighs `description` so a title hit ranks above a body mention.
serviceSchema.index(
  { name: "text", description: "text" },
  {
    name: "service_text",
    default_language: "spanish",
    weights: { name: 5, description: 1 },
  },
);

// Category tab + default "newest first" ordering, served entirely by the index
// (no in-memory sort of the whole category).
serviceSchema.index({ category: 1, createdAt: -1 });

// "Mis servicios".
serviceSchema.index({ owner: 1, createdAt: -1 });

// Distance filter (`$geoWithin`/`$centerSphere`).
serviceSchema.index({ location: "2dsphere" });

// Price sorting/filtering across the whole catalog.
serviceSchema.index({ priceFromCents: 1 });

export type ServiceDocument = InferSchemaType<typeof serviceSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Service: Model<ServiceDocument> =
  (models.Service as Model<ServiceDocument>) ||
  model<ServiceDocument>("Service", serviceSchema);
