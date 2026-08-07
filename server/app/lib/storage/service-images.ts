import { randomUUID } from "node:crypto";

import {
  getServiceImagesBucket,
  getServiceImagesPublicEndpoint,
  getStorageConfig,
} from "./config";
import {
  imageExtensionFor,
  isAllowedImageContentType,
  isOwnedKey,
} from "./image-types";
import {
  createUploadUrl,
  deleteObject,
  headObject,
  type StoredObjectMetaType,
  type UploadTargetType,
} from "./objects";

/**
 * Service photos live in their own bucket rather than sharing the avatars one:
 * the two have different lifecycles (an avatar dies with its user, a photo with
 * its service) and different size limits, and separating them keeps a future
 * per-bucket policy — CDN, retention, quotas — a config change.
 */

export function isAllowedServiceImageContentType(contentType: string): boolean {
  return isAllowedImageContentType(contentType);
}

/**
 * Key for a new service image: `<userId>/<uuid>.<ext>`.
 *
 * Namespaced by *owner*, not by service, because the image is uploaded before
 * the service exists (there is no id yet at that point) — and the owner prefix
 * is exactly what the confirm step can verify against the caller.
 */
export function buildServiceImageKey(
  userId: string,
  contentType: string,
): string {
  const extension = imageExtensionFor(contentType);
  if (!extension) {
    throw new Error(`Unsupported service image content type: ${contentType}`);
  }
  return `${userId}/${randomUUID()}.${extension}`;
}

/** Only keys under the caller's own prefix may be attached to a service. */
export function isOwnedServiceImageKey(key: string, userId: string): boolean {
  return isOwnedKey(key, userId);
}

/**
 * Public URL for a stored service image. Derived at read time (never
 * persisted), same as avatars, so changing bucket or CDN needs no migration.
 */
export function buildServiceImageUrl(
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  const { forcePathStyle } = getStorageConfig();
  const bucket = getServiceImagesBucket();
  const endpoint = getServiceImagesPublicEndpoint();
  return forcePathStyle ? `${endpoint}/${bucket}/${key}` : `${endpoint}/${key}`;
}

/** Issues a presigned PUT for a new service image. */
export async function createServiceImageUploadUrl(
  userId: string,
  contentType: string,
): Promise<UploadTargetType> {
  return createUploadUrl(
    getServiceImagesBucket(),
    buildServiceImageKey(userId, contentType),
    contentType,
  );
}

/** Metadata of a stored service image, or `null` when there is nothing there. */
export async function headServiceImageObject(
  key: string,
): Promise<StoredObjectMetaType | null> {
  return headObject(getServiceImagesBucket(), key);
}

/** Removes a service image. Missing objects are not an error (idempotent). */
export async function deleteServiceImageObject(key: string): Promise<void> {
  return deleteObject(getServiceImagesBucket(), key);
}
