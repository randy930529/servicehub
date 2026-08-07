import { randomUUID } from "node:crypto";

import { getStorageConfig } from "./config";
import {
  IMAGE_CONTENT_TYPES,
  imageExtensionFor,
  isAllowedImageContentType,
  isOwnedKey,
} from "./image-types";

/**
 * Image types accepted for an avatar, mapped to the extension used in the
 * object key. Same allow-list as every other upload — see `image-types.ts`.
 */
export const AVATAR_CONTENT_TYPES = IMAGE_CONTENT_TYPES;

export function isAllowedAvatarContentType(contentType: string): boolean {
  return isAllowedImageContentType(contentType);
}

/**
 * Builds the object key for a new avatar: `<userId>/<uuid>.<ext>`.
 *
 * The bucket is dedicated to avatars, so the user id is the only namespace
 * needed. The random component means a re-upload never reuses a key, so CDNs
 * and `expo-image` can't serve a stale cached avatar.
 */
export function buildAvatarKey(userId: string, contentType: string): string {
  const extension = imageExtensionFor(contentType);
  if (!extension) {
    throw new Error(`Unsupported avatar content type: ${contentType}`);
  }
  return `${userId}/${randomUUID()}.${extension}`;
}

/**
 * Guards the confirm step: a client could send back any key it likes, so only
 * keys under the caller's own prefix are accepted. Without this, user A could
 * claim user B's avatar object — or an arbitrary object in the bucket.
 */
export function isOwnedAvatarKey(key: string, userId: string): boolean {
  return isOwnedKey(key, userId);
}

/**
 * Public URL for a stored avatar. Derived at read time (never persisted) so
 * switching endpoint, bucket or CDN needs no data migration.
 */
export function buildAvatarUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const { publicEndpoint, bucket, forcePathStyle } = getStorageConfig();
  return forcePathStyle
    ? `${publicEndpoint}/${bucket}/${key}`
    : `${publicEndpoint}/${key}`;
}
