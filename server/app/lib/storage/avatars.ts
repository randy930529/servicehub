import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { buildAvatarKey } from "./avatar-keys";
import {
  getStorageConfig,
  getUploadUrlTtlSeconds,
  type StorageConfigType,
} from "./config";

/**
 * Two clients on purpose:
 *
 * - `internal` talks to storage over the private network (compose service
 *   name) and runs server-side operations: head, delete.
 * - `signing` is configured with the *public* endpoint, because SigV4 signs
 *   the Host header — a URL signed for `minio:9000` fails when the device
 *   sends it to `localhost:9000`.
 *
 * Cached per resolved endpoint so a test (or a changed env) gets a fresh
 * client instead of a stale one.
 */
const clients = new Map<string, S3Client>();

function getClient(config: StorageConfigType, endpoint: string): S3Client {
  const cached = clients.get(endpoint);
  if (cached) return cached;

  const client = new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  clients.set(endpoint, client);
  return client;
}

export type AvatarUploadTargetType = {
  /** Presigned PUT URL — the app uploads the bytes straight to storage. */
  uploadUrl: string;
  /** Object key to send back to `PUT /api/users/me/avatar` once uploaded. */
  key: string;
  /** Seconds the URL stays valid. */
  expiresIn: number;
};

/**
 * Issues a presigned PUT for a new avatar object.
 *
 * Only `ContentType` is signed, not `ContentLength`: signing the exact byte
 * count would make the upload fail on any off-by-one from the client. Size is
 * enforced instead when the upload is confirmed (`headAvatarObject`).
 */
export async function createAvatarUploadUrl(
  userId: string,
  contentType: string,
): Promise<AvatarUploadTargetType> {
  const config = getStorageConfig();
  const key = buildAvatarKey(userId, contentType);
  const expiresIn = getUploadUrlTtlSeconds();

  const uploadUrl = await getSignedUrl(
    getClient(config, config.publicEndpoint),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );

  return { uploadUrl, key, expiresIn };
}

export type AvatarObjectMetaType = {
  contentType: string | null;
  contentLength: number;
};

/**
 * Reads a stored object's metadata, or `null` when it doesn't exist.
 *
 * This is what makes the confirm step trustworthy: the client tells us a key,
 * and we check against storage that something was really uploaded there and
 * that it's within the declared type/size limits.
 */
export async function headAvatarObject(
  key: string,
): Promise<AvatarObjectMetaType | null> {
  const config = getStorageConfig();

  try {
    const result = await getClient(config, config.endpoint).send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    return {
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? 0,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Removes an avatar object. Missing objects are not an error (idempotent). */
export async function deleteAvatarObject(key: string): Promise<void> {
  const config = getStorageConfig();

  try {
    await getClient(config, config.endpoint).send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name } = error as { name?: string };
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}
