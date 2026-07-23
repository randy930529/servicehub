import { create } from "axios";

import { getApiBaseUrl } from "@/shared/lib/api-config";
import { toApiError } from "@/shared/lib/api-error";

import type { SessionTokens } from "../types";
import type { ApiSessionResponse } from "./api-session";

// Bare client, deliberately NOT `apiClient`: the refresh call must not carry
// the (expired) Bearer header nor re-enter the 401-refresh interceptor.
const bareClient = create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Exchanges a refresh token for a fresh token pair
 * (`POST /api/auth/refresh`). The presented token is revoked server-side
 * (rotation), so the returned pair must replace both stored tokens.
 *
 * Throws `ApiError` — a 401 means the session is no longer renewable
 * (revoked/expired) and the user must log in again.
 */
export async function refreshSession(
  refreshToken: string,
): Promise<SessionTokens> {
  try {
    const { data } = await bareClient.post<ApiSessionResponse>(
      "/api/auth/refresh",
      { refreshToken },
    );
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * Revokes a refresh token server-side (`POST /api/auth/logout`).
 * Best-effort: local logout must succeed even offline, so this never throws.
 */
export async function revokeSession(refreshToken: string): Promise<void> {
  try {
    await bareClient.post("/api/auth/logout", { refreshToken });
  } catch {
    // Ignored: worst case the token dies by expiry server-side.
  }
}
