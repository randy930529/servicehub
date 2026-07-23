/**
 * Shared fixtures for auth tests: the session body the auth endpoints return
 * (`SessionResponse`). Stub values use neutral, obviously-fake names so
 * secret scanners (GitGuardian) don't flag the diff.
 */

export const API_SESSION_USER = {
  _id: "665f1b2c9a1b2c3d4e5f6a7b",
  name: "Ana Pérez",
  email: "ana@test.com",
};

/** A `SessionResponse` with numbered tokens — `n` distinguishes rotations. */
export function apiSessionBody(n = 1) {
  return {
    user: API_SESSION_USER,
    accessToken: `stub-access-${n}`,
    refreshToken: `stub-refresh-${n}`,
    expiresIn: 900,
  };
}

export const API_SESSION_BODY = apiSessionBody();
