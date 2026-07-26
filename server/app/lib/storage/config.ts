import { envInt } from "@/app/lib/utils";

/** Resolved connection settings for the S3-compatible avatar bucket. */
export type StorageConfigType = {
  /** Endpoint the *server* uses to talk to storage (compose network in dev). */
  endpoint: string;
  /**
   * Endpoint baked into presigned URLs. Must be reachable from the device:
   * SigV4 signs the Host header, so a URL signed for `minio:9000` is rejected
   * when the app sends it to `localhost:9000`.
   */
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO needs path-style URLs (`http://host/bucket/key`); AWS S3 doesn't. */
  forcePathStyle: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to server/.env.local (see .env.example).`,
    );
  }
  return value;
}

/** Strips trailing slashes so URL joining never produces `host//bucket`. */
function normalizeEndpoint(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Reads storage settings from the environment.
 *
 * Deliberately lazy (called per use, not at module load) so tests and env
 * overrides apply after import — same approach as the JWT token helpers.
 */
export function getStorageConfig(): StorageConfigType {
  const endpoint = normalizeEndpoint(requireEnv("NEXT_S3_ENDPOINT"));

  return {
    endpoint,
    publicEndpoint: normalizeEndpoint(
      process.env.NEXT_S3_PUBLIC_ENDPOINT || endpoint,
    ),
    // MinIO ignores the region, but the AWS SDK refuses to sign without one.
    region: process.env.NEXT_S3_REGION || "us-east-1",
    bucket: requireEnv("NEXT_S3_BUCKET"),
    accessKeyId: requireEnv("NEXT_S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("NEXT_S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.NEXT_S3_FORCE_PATH_STYLE !== "false",
  };
}

/** Lifetime of a presigned upload URL, in seconds. */
export function getUploadUrlTtlSeconds(): number {
  return envInt("NEXT_S3_UPLOAD_URL_TTL_SECONDS", 300, 30, 3600);
}

/** Largest avatar the API accepts, in bytes (default 5 MB). */
export function getAvatarMaxBytes(): number {
  return envInt("NEXT_AVATAR_MAX_BYTES", 5 * 1024 * 1024, 1024, 50 * 1024 * 1024);
}
