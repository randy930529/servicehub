import { apiClient } from "@/shared/lib/api-client";
import { putFileToSignedUrl, readFileForUpload } from "@/shared/lib/file-upload";
import type { PreparedImage } from "@/shared/lib/image-picker";

import type { ServiceImageUploadTarget } from "../types";

/**
 * Uploads a service photo and returns its storage key.
 *
 * Two steps here, a third one later:
 *
 * 1. ask the API for a presigned PUT (it validates type and size first),
 * 2. send the bytes straight to storage — they never pass through our API.
 *
 * The key is then attached by whoever saves the service (`createService` /
 * `updateService`), which is what makes the object verified before it's shown:
 * an upload nobody confirms is just an orphan object.
 */
export async function uploadServiceImage(
  image: PreparedImage,
): Promise<string> {
  const payload = await readFileForUpload(image.uri);

  const { data: target } = await apiClient.post<ServiceImageUploadTarget>(
    "/api/services/image/upload-url",
    { contentType: image.contentType, size: payload.size },
  );

  await putFileToSignedUrl(target.uploadUrl, payload, image.contentType);

  return target.key;
}
