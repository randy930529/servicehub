/**
 * Auth domain models.
 *
 * Plain TypeScript types shared between screens, use-cases and (in the future)
 * the data/API layer. No React, no UI, no persistence concerns here.
 */

/** Credentials used to authenticate an existing user. */
export interface Credentials {
  email: string;
  password: string;
}

/** Data required to create a new account. */
export interface RegistrationData {
  name: string;
  email: string;
  password: string;
}

/** Opaque token returned by the backend after a successful authentication. */
export type AuthToken = string;

/** The authenticated user, as the backend exposes it. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Result of an authentication use-case (login/register/refresh):
 *
 * - `accessToken` — short-lived JWT sent as `Authorization: Bearer`.
 * - `refreshToken` — long-lived, single-use token to renew the session.
 */
export interface AuthSession {
  user: AuthUser;
  accessToken: AuthToken;
  refreshToken: AuthToken;
}

/** Just the renewable part of a session (what a refresh returns). */
export type SessionTokens = Pick<AuthSession, "accessToken" | "refreshToken">;
