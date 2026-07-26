import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

/**
 * A local file prepared for upload: the bytes plus their measured length.
 *
 * The size is needed *before* the upload starts, because the API pre-checks it
 * when issuing the presigned URL.
 */
export type UploadPayloadType = {
  body: Blob;
  size: number;
};

/**
 * Opens a local file so it can be uploaded.
 *
 * `expo-file-system`'s `File` implements `Blob`, so it can be handed straight
 * to `expo/fetch` as a request body — the bytes never get loaded into JS
 * memory, which matters for multi-megabyte photos.
 */
export async function readFileForUpload(
  uri: string,
): Promise<UploadPayloadType> {
  const file = new File(uri);
  return { body: file, size: file.size ?? 0 };
}

/**
 * Uploads the bytes to a presigned URL with a plain PUT.
 *
 * Deliberately *not* the shared `apiClient`: this request goes to the storage
 * service, not to our API, so it must not carry the `Authorization` header —
 * the signature in the URL is the credential, and an extra auth header makes
 * S3-compatible services reject the request.
 */
export async function putFileToSignedUrl(
  url: string,
  payload: UploadPayloadType,
  contentType: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    body: payload.body,
    headers: { "Content-Type": contentType },
  });

  if (!response.ok) {
    throw new Error(`Avatar upload failed with status ${response.status}`);
  }
}
