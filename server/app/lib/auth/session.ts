import type { HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";

import type { SubmitError } from "@/app/lib/core";
import { PublicUserType, SessionResponseType } from "@/app/lib/definitions";
import { User, type UserDocument } from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import { buildAvatarUrl } from "@/app/lib/storage";
import {
  generateRefreshToken,
  getAccessTokenTtlSeconds,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";

export function toPublicUser(
  user: HydratedDocument<UserDocument>,
): PublicUserType {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio ?? "",
    phone: user.phone ?? "",
    // Derived from the stored key — the key itself never leaves the server.
    avatarUrl: buildAvatarUrl(user.avatarKey),
  };
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

/**
 * Result of authenticating a request: either the user document, or why it
 * failed. `missing` and `invalid` are both answered with a 401 but carry
 * different messages.
 */
export type AuthResultType =
  | { ok: true; user: HydratedDocument<UserDocument> }
  | { ok: false; reason: "missing" | "invalid" };

/**
 * Bearer-token guard shared by every protected endpoint: verifies the access
 * JWT and loads the user it points at. A token that is well-formed but whose
 * user no longer exists is treated as invalid, not as a 404.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthResultType> {
  const token = getBearerToken(request);
  if (!token) return { ok: false, reason: "missing" };

  const claims = await verifyAccessToken(token);
  if (!claims) return { ok: false, reason: "invalid" };

  await connectToDatabase();
  const user = await User.findById(claims.sub);
  if (!user) return { ok: false, reason: "invalid" };

  return { ok: true, user };
}

/** 401 body shared by every protected endpoint, in the standard error shape. */
export function authErrorResponse(
  reason: "missing" | "invalid",
): NextResponse<SubmitError> {
  return NextResponse.json(
    {
      type: "VALIDATION_ERROR",
      message:
        reason === "missing"
          ? "Missing access token"
          : "Invalid or expired access token",
    },
    { status: 401 },
  );
}
