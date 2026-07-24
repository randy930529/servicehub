import { apiClient } from "@/shared/lib/api-client";

import type { AuthSession, Credentials } from "../types";
import { toAuthSession, type ApiSessionResponse } from "./api-session";

/**
 * Authenticates a user with email + password against the backend
 * (`POST /api/auth/login`) and returns the session (user + token pair).
 *
 * Failures surface as `ApiError` (401 = wrong credentials).
 */
export async function loginUser(
  credentials: Credentials,
): Promise<AuthSession> {
  const { data } = await apiClient.post<ApiSessionResponse>(
    "/api/auth/login",
    credentials,
  );
  return toAuthSession(data);
}
