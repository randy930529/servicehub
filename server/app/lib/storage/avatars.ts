import { buildAvatarKey } from "./avatar-keys";
import { getStorageConfig } from "./config";
import {
  createUploadUrl,
  deleteObject,
  headObject,
  type StoredObjectMetaType,
  type UploadTargetType,
} from "./objects";

// Aliases of the generic object types, kept so call sites read as avatar code.
export type AvatarUploadTargetType = UploadTargetType;
export type AvatarObjectMetaType = StoredObjectMetaType;

/** Issues a presigned PUT for a new avatar object in the avatars bucket. */
export async function createAvatarUploadUrl(
  userId: string,
  contentType: string,
): Promise<AvatarUploadTargetType> {
  const { bucket } = getStorageConfig();
  return createUploadUrl(bucket, buildAvatarKey(userId, contentType), contentType);
}

/** Metadata of a stored avatar, or `null` when nothing was uploaded there. */
export async function headAvatarObject(
  key: string,
): Promise<AvatarObjectMetaType | null> {
  const { bucket } = getStorageConfig();
  return headObject(bucket, key);
}

/** Removes an avatar object. Missing objects are not an error (idempotent). */
export async function deleteAvatarObject(key: string): Promise<void> {
  const { bucket } = getStorageConfig();
  return deleteObject(bucket, key);
}
