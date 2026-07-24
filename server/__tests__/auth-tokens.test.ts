import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "../app/lib/auth";

const CLAIMS = { sub: "665f1b2c9a1b2c3d4e5f6a7b", email: "ana@test.com" };

describe("access tokens (JWT)", () => {
  beforeEach(() => {
    process.env.NEXT_JWT_SECRET = "test-secret-for-unit-tests";
  });

  it("sign → verify roundtrip returns the claims", async () => {
    const token = await signAccessToken(CLAIMS);
    const verified = await verifyAccessToken(token);
    assert.deepEqual(verified, CLAIMS);
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken(CLAIMS);
    const tampered = `${token.slice(0, -2)}xx`;
    assert.equal(await verifyAccessToken(tampered), null);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signAccessToken(CLAIMS);
    process.env.NEXT_JWT_SECRET = "a-different-secret";
    assert.equal(await verifyAccessToken(token), null);
  });

  it("rejects an expired token", async () => {
    const token = await signAccessToken(CLAIMS, 0);
    assert.equal(await verifyAccessToken(token), null);
  });

  it("fails loudly when NEXT_JWT_SECRET is missing", async () => {
    delete process.env.NEXT_JWT_SECRET;
    await assert.rejects(() => signAccessToken(CLAIMS), /NEXT_JWT_SECRET/);
  });
});

describe("refresh tokens", () => {
  it("generates unique tokens with a matching stored hash", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    assert.notEqual(first.token, second.token);
    assert.equal(first.tokenHash, hashRefreshToken(first.token));
    // The plain token must never equal what gets persisted.
    assert.notEqual(first.token, first.tokenHash);
  });

  it("expires in the future (default 30 days)", () => {
    const { expiresAt } = generateRefreshToken();
    const days = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    assert.ok(days > 29 && days <= 30);
  });

  it("hashing is deterministic (lookup key) and one-way", () => {
    assert.equal(hashRefreshToken("abc"), hashRefreshToken("abc"));
    assert.notEqual(hashRefreshToken("abc"), hashRefreshToken("abd"));
  });
});
