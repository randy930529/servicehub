import type { AuthSession } from "../types";

/**
 * Session payload as returned by the auth endpoints
 * (`POST /api/auth/{register,login,refresh}` → `SessionResponse`).
 */
export interface ApiSessionResponse {
  user: { _id: string; name: string; email: string };
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds (unused by the app for now). */
  expiresIn: number;
}

/** Maps the API shape (`_id`, Mongo fields) to the domain `AuthSession`. */
export function toAuthSession(api: ApiSessionResponse): AuthSession {
  const { user, accessToken, refreshToken } = api;
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
    accessToken: accessToken,
    refreshToken: refreshToken,
  };
}
