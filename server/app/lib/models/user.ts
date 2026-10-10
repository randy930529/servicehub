import { DEFAULT_WORKING_HOURS } from "@/app/lib/helpers/availability";
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * A refresh token session. Only the SHA-256 hash of the token is stored —
 * a database leak must not hand out usable refresh tokens.
 */
const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

/** Weekly schedule. Hours are market-local; see `helpers/availability.ts`. */
const workingHoursSchema = new Schema(
  {
    startHour: { type: Number, required: true, min: 0, max: 23 },
    /** Exclusive: 18 means the 17:00 slot is the last one of the day. */
    endHour: { type: Number, required: true, min: 1, max: 24 },
    /** 0 = Sunday, matching `Date.getUTCDay()`. */
    weekdays: { type: [Number], required: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    /** bcrypt hash — the plain password is never persisted. */
    passwordHash: { type: String, required: true },
    /** Short self-description shown on the profile screen. */
    bio: { type: String, trim: true, default: "" },
    /** Contact phone. Free-form: formats vary too much per country to enforce. */
    phone: { type: String, trim: true, default: "" },
    /**
     * Object key of the avatar inside the storage bucket (e.g.
     * `avatars/<userId>/<uuid>.jpg`). The public URL is derived from it at
     * read time so moving buckets/CDNs never requires a data migration.
     */
    avatarKey: { type: String, default: null },
    /** Active sessions (one per device); pruned of expired entries on refresh. */
    refreshTokens: { type: [refreshTokenSchema], default: [] },
    /**
     * When this user, acting as a provider, takes bookings. Market-local
     * hours (see `helpers/availability.ts`). Everyone gets the default until
     * they change it, so a provider who never opens this screen is still
     * bookable.
     */
    workingHours: {
      type: workingHoursSchema,
      default: () => ({ ...DEFAULT_WORKING_HOURS }),
    },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) ||
  model<UserDocument>("User", userSchema);
