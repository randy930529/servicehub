/**
 * Profile domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer.
 * No React, no UI, no persistence concerns here.
 */

/** The authenticated user's editable profile. */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  phone: string;
  /** Absolute URL of the avatar, or `null` when the user has none. */
  avatarUrl: string | null;
  /** When this user takes bookings, as a provider. */
  workingHours: WorkingHours;
}

/**
 * A provider's weekly schedule, in market-local hours.
 *
 * `endHour` is exclusive: 18 means the 17:00 slot is the last of the day.
 * `weekdays` uses 0 = Sunday.
 */
export interface WorkingHours {
  startHour: number;
  endHour: number;
  weekdays: number[];
}

/** What a provider gets until they change it. Mirrors the API's default. */
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  startHour: 9,
  endHour: 18,
  weekdays: [1, 2, 3, 4, 5, 6],
};

/** Fields a user can change. Partial: a PATCH only sends what changed. */
export interface ProfileUpdate {
  name?: string;
  bio?: string;
  phone?: string;
  workingHours?: WorkingHours;
}

/**
 * An image already cropped and compressed on-device, ready to be uploaded.
 * Owned by `shared/lib/image-picker` (avatars and service photos share it);
 * re-exported here so the feature's public API stays self-contained.
 */
export type { PreparedImage } from "@/shared/lib/image-picker";

/** Presigned upload target returned by the API (step 1 of the avatar flow). */
export interface AvatarUploadTarget {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  maxBytes: number;
}
