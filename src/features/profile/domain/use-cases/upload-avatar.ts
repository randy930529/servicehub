import { apiClient } from "@/shared/lib/api-client";
import {
  putFileToSignedUrl,
  readFileForUpload,
} from "@/shared/lib/file-upload";

import type { AvatarUploadTarget, PreparedImage, UserProfile } from "../types";
import { toUserProfile, type ApiProfileResponse } from "./api-profile";

/**
 * Uploads a new avatar in the three steps the presigned-URL flow requires:
 *
 * 1. ask the API for a presigned PUT (it validates type and size first),
 * 2. send the bytes straight to storage — they never pass through our API,
 * 3. confirm the key so the API can verify the object and attach it.
 *
 * Steps 2 and 3 are separate on purpose: an upload that never gets confirmed
 * leaves an orphan object, but can never point a user at unverified bytes.
 */
export async function uploadAvatar(
  image: PreparedImage,
): Promise<UserProfile> {
  const payload = await readFileForUpload(image.uri);

  const { data: target } = await apiClient.post<AvatarUploadTarget>(
    "/api/users/me/avatar/upload-url",
    { contentType: image.contentType, size: payload.size },
  );

  await putFileToSignedUrl(target.uploadUrl, payload, image.contentType);

  const { data } = await apiClient.put<ApiProfileResponse>(
    "/api/users/me/avatar",
    { key: target.key },
  );
  return toUserProfile(data);
}
