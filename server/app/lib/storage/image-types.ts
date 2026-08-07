/**
 * Image types the API accepts for any user-supplied upload (avatars, service
 * photos), mapped to the extension used in the object key.
 *
 * An allow-list — never a deny-list — keeps SVG, and the XSS it can carry when
 * served from our own origin, out of the buckets.
 */
export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedImageContentType(contentType: string): boolean {
  return contentType in IMAGE_CONTENT_TYPES;
}

/** File extension for a supported content type, or `null` when unsupported. */
export function imageExtensionFor(contentType: string): string | null {
  return IMAGE_CONTENT_TYPES[contentType] ?? null;
}

/**
 * Guards every "confirm the upload" step: a client can send back any key it
 * likes, so only keys under the caller's own prefix are accepted. Without this,
 * user A could claim user B's object — or an arbitrary object in the bucket.
 */
export function isOwnedKey(key: string, prefix: string): boolean {
  if (key.includes("..") || key.includes("//")) return false;
  return key.startsWith(`${prefix}/`);
}
