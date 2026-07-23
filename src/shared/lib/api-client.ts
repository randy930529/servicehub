import { create, isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { getApiBaseUrl } from "./api-config";
import { toApiError } from "./api-error";

/**
 * Shared Axios instance for the ServiceHub backend. Feature data layers (e.g.
 * services use-cases) call the API through this client so base URL, timeout and
 * cross-cutting concerns (auth header, refresh flow, error normalization) live
 * in one place.
 */
export const apiClient = create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

type AuthTokenProvider = () => string | null;

/**
 * Renews the session and returns the new access token, or `null` when the
 * session can't be renewed (no refresh token, refresh rejected).
 */
type AuthSessionRefresher = () => Promise<string | null>;

// shared/ must not import features/, so the auth feature injects its token
// reader and refresher instead of the client importing the auth store.
let getAuthToken: AuthTokenProvider = () => null;
let refreshAuthSession: AuthSessionRefresher = async () => null;

/**
 * Registers where the client reads the session token from. Called once by the
 * auth feature (`features/auth/stores/auth.store.ts`) at module load.
 */
export function setAuthTokenProvider(provider: AuthTokenProvider) {
  getAuthToken = provider;
}

/**
 * Registers how the client renews an expired session (401 → refresh → retry).
 * Called once by the auth feature at module load.
 */
export function setAuthSessionRefresher(refresher: AuthSessionRefresher) {
  refreshAuthSession = refresher;
}

// Single-flight: when several requests 401 at once (expired token), they all
// await the same refresh instead of burning N refresh tokens (rotation makes
// every extra call invalidate the previous one).
let refreshInFlight: Promise<string | null> | null = null;

function refreshSessionOnce(): Promise<string | null> {
  refreshInFlight ??= refreshAuthSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** For tests: forget an in-flight refresh between cases. */
export function resetAuthRefreshState() {
  refreshInFlight = null;
}

// Attach the session token (when there is one) to every request.
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

// A 401 on these endpoints is a business answer (wrong credentials, dead
// refresh token), not an expired access token — refreshing won't help.
const NO_REFRESH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
];

/**
 * Response interceptor:
 *
 * 1. On a 401 from a protected endpoint (first time only), refresh the
 *    session and retry the original request with the new access token.
 * 2. Normalize every remaining failure into an `ApiError` so callers
 *    (use-cases, React Query, screens) never deal with axios internals.
 */
apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  const apiError = toApiError(error);
  const config = isAxiosError(error)
    ? (error.config as RetriableConfig | undefined)
    : undefined;

  const refreshable =
    apiError.status === 401 &&
    config !== undefined &&
    !config._authRetry &&
    !NO_REFRESH_PATHS.includes(config.url ?? "");

  if (refreshable) {
    config._authRetry = true;
    const accessToken = await refreshSessionOnce();
    if (accessToken) {
      // The request interceptor re-reads the (now rotated) token anyway;
      // set it here too so the retry never races the store update.
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient.request(config);
    }
  }

  return Promise.reject(apiError);
});
