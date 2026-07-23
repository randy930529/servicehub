import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

import {
  setAuthSessionRefresher,
  setAuthTokenProvider,
} from "@/shared/lib/api-client";
import { ApiError } from "@/shared/lib/api-error";

import type { AuthSession, AuthUser, SessionTokens } from "../domain/types";
import {
  refreshSession,
  revokeSession,
} from "../domain/use-cases/refresh-session";

// Key kept from the single-token era so existing sessions survive the update.
const ACCESS_TOKEN_KEY = "sh_auth_token";
const REFRESH_TOKEN_KEY = "sh_refresh_token";

type AuthState = {
  /** Short-lived access JWT (sent as `Authorization: Bearer`). */
  token: string | null;
  /** Long-lived, single-use token that renews the session. */
  refreshToken: string | null;
  /** In-memory only — refetched (`GET /api/auth/me`) rather than persisted. */
  user: AuthUser | null;
  isHydrated: boolean;
  login: (session: AuthSession) => Promise<void>;
  /** Replaces the persisted token pair (refresh rotates both). */
  setTokens: (tokens: SessionTokens) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isHydrated: false,

  login: async ({ user, accessToken, refreshToken }) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
    set({ token: accessToken, refreshToken, user });
  },

  setTokens: async ({ accessToken, refreshToken }) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
    set({ token: accessToken, refreshToken });
  },

  logout: async () => {
    const { refreshToken } = get();
    // Best-effort server-side revocation; never blocks the local sign-out.
    if (refreshToken) {
      void revokeSession(refreshToken);
    }
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
    set({ token: null, refreshToken: null, user: null });
  },

  hydrate: async () => {
    const [token, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    set({ token, refreshToken, isHydrated: true });
  },
}));

// Let the shared API client read the session token without shared/ having to
// import this feature (dependency rule: features → shared, never the reverse).
setAuthTokenProvider(() => useAuthStore.getState().token);

// Same injection for the 401 → refresh → retry flow: exchange the stored
// refresh token for a new pair and hand the new access token back to the
// interceptor. A definitive rejection (4xx: revoked/expired) signs the user
// out; a transient failure (network/5xx) keeps the session for a later retry.
setAuthSessionRefresher(async () => {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const tokens = await refreshSession(refreshToken);
    await useAuthStore.getState().setTokens(tokens);
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof ApiError && error.kind === "client") {
      await useAuthStore.getState().logout();
    }
    return null;
  }
});
