import { apiClient } from "@/shared/lib/api-client";

import type { AuthSession, RegistrationData } from "../types";
import { toAuthSession, type ApiSessionResponse } from "./api-session";

/**
 * Creates a new account (`POST /api/auth/register`) and returns the session
 * for the freshly created user — registering also signs you in.
 *
 * Failures surface as `ApiError` (409 = email already registered).
 */
export async function registerUser(
  data: RegistrationData,
): Promise<AuthSession> {
  const { name, email, password } = data;
  const { data: body } = await apiClient.post<ApiSessionResponse>(
    "/api/auth/register",
    { name, email, password },
  );
  return toAuthSession(body);
}
