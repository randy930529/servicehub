import {
  AccessTokenClaimsType,
  GeneratedRefreshTokenType,
} from "@/app/lib/definitions";
import { envInt } from "@/app/lib/utils";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

const DAY_IN_SECONDS = 24 * 60 * 60;

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXT_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Missing NEXT_JWT_SECRET. Add it to server/.env.local (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Read TTLs lazily so tests/env overrides apply after module load. */
export function getAccessTokenTtlSeconds(): number {
  return envInt("NEXT_JWT_ACCESS_TTL_SECONDS", 15 * 60, 60, DAY_IN_SECONDS);
}

/** Returns the number of days a refresh token should be valid. */
export function getRefreshTokenTtlDays(): number {
  return envInt("NEXT_REFRESH_TOKEN_TTL_DAYS", 30, 1, 365);
}

/** Signs a short-lived access JWT for the given user. */
export async function signAccessToken(
  claims: AccessTokenClaimsType,
  ttlSeconds = getAccessTokenTtlSeconds(),
): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getJwtSecret());
}

/**
 * Verifies an access JWT (signature + expiry). Returns its claims, or `null`
 * when the token is invalid or expired — callers answer 401, not 500.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaimsType | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** Creates a new opaque refresh token plus the hash/expiry to persist. */
export function generateRefreshToken(): GeneratedRefreshTokenType {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + getRefreshTokenTtlDays() * DAY_IN_SECONDS * 1000,
  );
  return { token, tokenHash: hashRefreshToken(token), expiresAt };
}

/** Deterministic hash used to look a presented refresh token up in Mongo. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
