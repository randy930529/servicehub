import axios from "axios";

import { getApiBaseUrl } from "./api-config";
import { toApiError } from "./api-error";

/**
 * Shared Axios instance for the ServiceHub backend. Feature data layers (e.g.
 * services use-cases) call the API through this client so base URL, timeout and
 * cross-cutting concerns (auth header, error normalization) live in one place.
 */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

type AuthTokenProvider = () => string | null;

// shared/ must not import features/, so the auth feature injects its token
// reader instead of the client importing the auth store directly.
let getAuthToken: AuthTokenProvider = () => null;

/**
 * Registers where the client reads the session token from. Called once by the
 * auth feature (`features/auth/stores/auth.store.ts`) at module load.
 */
export function setAuthTokenProvider(provider: AuthTokenProvider) {
  getAuthToken = provider;
}

// Auth skeleton: attach the session token (when there is one) to every
// request. The backend has no protected endpoints yet; when they land, only
// the server needs to start checking the header.
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize every failure into an ApiError so callers (use-cases, React
// Query, screens) can branch on `kind`/`status` instead of axios internals.
apiClient.interceptors.response.use(undefined, (error: unknown) =>
  Promise.reject(toApiError(error)),
);
