import { apiClient } from "@/shared/lib/api-client";

import type { UserProfile } from "../types";
import { toUserProfile, type ApiProfileResponse } from "./api-profile";

/** Drops the current avatar. Idempotent — removing a missing one still works. */
export async function removeAvatar(): Promise<UserProfile> {
  const { data } = await apiClient.delete<ApiProfileResponse>(
    "/api/users/me/avatar",
  );
  return toUserProfile(data);
}
