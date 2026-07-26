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
}

/** Fields a user can change. Partial: a PATCH only sends what changed. */
export interface ProfileUpdate {
  name?: string;
  bio?: string;
  phone?: string;
}

/**
 * An image already cropped and compressed on-device, ready to be uploaded.
 * `contentType` has to match what the presigned URL is signed for.
 */
export interface PreparedImage {
  uri: string;
  contentType: string;
}

/** Presigned upload target returned by the API (step 1 of the avatar flow). */
export interface AvatarUploadTarget {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  maxBytes: number;
}
