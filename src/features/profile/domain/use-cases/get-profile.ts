import { apiClient } from "@/shared/lib/api-client";

import type { UserProfile } from "../types";
import { toUserProfile, type ApiProfileResponse } from "./api-profile";

/**
 * Loads the authenticated user's profile.
 *
 * The access token is attached by the shared client's interceptor, which also
 * refreshes it transparently on a 401.
 */
export async function getProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<ApiProfileResponse>("/api/users/me");
  return toUserProfile(data);
}
