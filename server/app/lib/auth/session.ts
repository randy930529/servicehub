import type { HydratedDocument } from "mongoose";

import { PublicUserType, SessionResponseType } from "@/app/lib/definitions";
import type { UserDocument } from "@/app/lib/models/user";
import {
  generateRefreshToken,
  getAccessTokenTtlSeconds,
  signAccessToken,
} from "./tokens";

export function toPublicUser(
  user: HydratedDocument<UserDocument>,
): PublicUserType {
  return { _id: user.id, name: user.name, email: user.email };
}

/**
 * Issues a new token pair for the user and persists the refresh token's hash.
 * When `replaceTokenHash` is given (refresh flow) that session entry is
 * replaced — rotation; otherwise the new session is appended (login on a new
 * device keeps other devices signed in). Expired entries are pruned either way.
 */
export async function issueSession(
  user: HydratedDocument<UserDocument>,
  replaceTokenHash?: string,
): Promise<SessionResponseType> {
  const refresh = generateRefreshToken();
  const now = new Date();

  // Mutate the DocumentArray in place (assigning a plain array breaks
  // Mongoose's typings): drop expired sessions and the rotated-out token.
  const stale = user.refreshTokens.filter(
    (entry) => entry.expiresAt <= now || entry.tokenHash === replaceTokenHash,
  );
  for (const entry of stale) {
    user.refreshTokens.pull(entry);
  }
  user.refreshTokens.push({
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
  });
  await user.save();

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
  });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken: refresh.token,
    expiresIn: getAccessTokenTtlSeconds(),
  };
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
