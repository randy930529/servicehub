/**
 * Web implementation of the upload helpers (see `file-upload.ts` for the
 * native one and the full documentation).
 *
 * `expo-file-system` is native-only, but on web the picker hands us a blob or
 * object URL that the standard `fetch`/`Blob` APIs already understand.
 */

export type UploadPayloadType = {
  body: Blob;
  size: number;
};

export async function readFileForUpload(
  uri: string,
): Promise<UploadPayloadType> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return { body: blob, size: blob.size };
}

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
