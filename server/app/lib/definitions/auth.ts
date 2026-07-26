/** Claims carried by the access JWT. `sub` is the Mongo user id. */
export type AccessTokenClaimsType = {
  sub: string;
  email: string;
};

export type GeneratedRefreshTokenType = {
  /** The plain token sent to the client (never persisted). */
  token: string;
  /** SHA-256 hex digest stored on the user document. */
  tokenHash: string;
  expiresAt: Date;
};

/** Public shape of a user — never includes `passwordHash`/`refreshTokens`. */
export type PublicUserType = {
  _id: string;
  name: string;
  email: string;
  bio: string;
  phone: string;
  /**
   * Absolute URL of the avatar, derived from the stored object key, or `null`
   * when the user hasn't uploaded one. The key itself stays server-side.
   */
  avatarUrl: string | null;
};

/** Body returned by every endpoint that opens/renews a session. */
export type SessionResponseType = {
  user: PublicUserType;
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds, so clients can schedule refreshes. */
  expiresIn: number;
};

export type UserType = {
  name: string;
  email: string;
  password: string;
};
