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

/** Result of an authentication use-case. */
export interface AuthSession {
  token: AuthToken;
}
