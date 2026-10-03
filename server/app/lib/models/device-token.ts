import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/** Platforms that can hold a push token. */
export const DEVICE_PLATFORMS = ["ios", "android", "web"] as const;

export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/**
 * A device registered to receive push notifications.
 *
 * Its own collection rather than an array on `User`: a token belongs to a
 * *device*, not to a person. The same phone can sign in as someone else — the
 * token then moves owner instead of being duplicated — and Expo can tell us a
 * token is dead (`DeviceNotRegistered`) without us knowing whose it was.
 */
const deviceTokenSchema = new Schema(
  {
    /** Expo push token, e.g. `ExponentPushToken[xxxxxxxx]`. */
    token: { type: String, required: true, unique: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    platform: { type: String, required: true, enum: DEVICE_PLATFORMS },
    /** Free-form label so a user could tell their devices apart later. */
    deviceName: { type: String, trim: true, default: null },
    /**
     * Refreshed every time the app re-registers. A token that hasn't been seen
     * in months is a good candidate for pruning: Expo rotates them, and an app
     * that never comes back never tells us it's gone.
     */
    lastSeenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

/** Sending to a user reads every token they own, newest first. */
deviceTokenSchema.index({ owner: 1, lastSeenAt: -1 });

export type DeviceTokenDocument = InferSchemaType<typeof deviceTokenSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const DeviceToken: Model<DeviceTokenDocument> =
  (models.DeviceToken as Model<DeviceTokenDocument>) ||
  model<DeviceTokenDocument>("DeviceToken", deviceTokenSchema);
