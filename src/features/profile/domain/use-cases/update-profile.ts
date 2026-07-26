import { apiClient } from "@/shared/lib/api-client";

import type { ProfileUpdate, UserProfile } from "../types";
import { toUserProfile, type ApiProfileResponse } from "./api-profile";

/**
 * Saves profile changes and returns the profile as the server stored it
 * (trimmed, normalized), rather than echoing back what was sent.
 */
export async function updateProfile(
  changes: ProfileUpdate,
): Promise<UserProfile> {
  const { data } = await apiClient.patch<ApiProfileResponse>(
    "/api/users/me",
    changes,
  );
  return toUserProfile(data);
}
