import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  buildAvatarKey,
  buildAvatarUrl,
  isAllowedAvatarContentType,
  isOwnedAvatarKey,
} from "../app/lib/storage/avatar-keys";

const USER_ID = "665f1b2c9a1b2c3d4e5f6a7b";
const OTHER_USER_ID = "665f1b2c9a1b2c3d4e5f6a7c";

function setStorageEnv() {
  process.env.NEXT_S3_ENDPOINT = "http://minio:9000";
  process.env.NEXT_S3_PUBLIC_ENDPOINT = "http://localhost:9000";
  process.env.NEXT_S3_BUCKET = "avatars";
  process.env.NEXT_S3_ACCESS_KEY_ID = "test-key";
  process.env.NEXT_S3_SECRET_ACCESS_KEY = "test-secret";
  delete process.env.NEXT_S3_FORCE_PATH_STYLE;
}

describe("avatar content types", () => {
  it("accepts the supported image types", () => {
    assert.ok(isAllowedAvatarContentType("image/jpeg"));
    assert.ok(isAllowedAvatarContentType("image/png"));
    assert.ok(isAllowedAvatarContentType("image/webp"));
  });

  it("rejects SVG, which can carry script when served from our origin", () => {
    assert.equal(isAllowedAvatarContentType("image/svg+xml"), false);
  });

  it("rejects anything else", () => {
    assert.equal(isAllowedAvatarContentType("application/pdf"), false);
    assert.equal(isAllowedAvatarContentType("text/html"), false);
    assert.equal(isAllowedAvatarContentType(""), false);
  });
});

describe("buildAvatarKey", () => {
  it("namespaces the key by user and maps the extension", () => {
    const key = buildAvatarKey(USER_ID, "image/jpeg");
    assert.ok(key.startsWith(`${USER_ID}/`));
    assert.ok(key.endsWith(".jpg"));
  });

  it("uses the right extension per content type", () => {
    assert.ok(buildAvatarKey(USER_ID, "image/png").endsWith(".png"));
    assert.ok(buildAvatarKey(USER_ID, "image/webp").endsWith(".webp"));
  });

  it("never reuses a key, so a new avatar can't hit a stale cache", () => {
    const first = buildAvatarKey(USER_ID, "image/jpeg");
    const second = buildAvatarKey(USER_ID, "image/jpeg");
    assert.notEqual(first, second);
  });

  it("refuses an unsupported content type", () => {
    assert.throws(
      () => buildAvatarKey(USER_ID, "image/svg+xml"),
      /Unsupported avatar content type/,
    );
  });
});

describe("isOwnedAvatarKey", () => {
  it("accepts a key under the caller's own prefix", () => {
    const key = buildAvatarKey(USER_ID, "image/jpeg");
    assert.ok(isOwnedAvatarKey(key, USER_ID));
  });

  it("rejects another user's key", () => {
    const key = buildAvatarKey(OTHER_USER_ID, "image/jpeg");
    assert.equal(isOwnedAvatarKey(key, USER_ID), false);
  });

  it("rejects path traversal out of the user's prefix", () => {
    assert.equal(
      isOwnedAvatarKey(`${USER_ID}/../${OTHER_USER_ID}/x.jpg`, USER_ID),
      false,
    );
    assert.equal(isOwnedAvatarKey(`${USER_ID}//secret.jpg`, USER_ID), false);
  });

  it("rejects keys outside the user's namespace", () => {
    assert.equal(isOwnedAvatarKey(`backups/${USER_ID}/dump.jpg`, USER_ID), false);
    assert.equal(isOwnedAvatarKey("", USER_ID), false);
  });

  it("rejects a prefix that merely starts with the user id", () => {
    // `<id>x/...` must not pass as `<id>/...`.
    assert.equal(isOwnedAvatarKey(`${USER_ID}x/photo.jpg`, USER_ID), false);
  });
});

describe("buildAvatarUrl", () => {
  beforeEach(setStorageEnv);

  it("returns null when there is no avatar", () => {
    assert.equal(buildAvatarUrl(null), null);
    assert.equal(buildAvatarUrl(undefined), null);
    assert.equal(buildAvatarUrl(""), null);
  });

  it("builds a path-style URL including the bucket (MinIO)", () => {
    assert.equal(
      buildAvatarUrl(`${USER_ID}/photo.jpg`),
      `http://localhost:9000/avatars/${USER_ID}/photo.jpg`,
    );
  });

  it("uses the public endpoint, never the internal one", () => {
    const url = buildAvatarUrl(`${USER_ID}/photo.jpg`);
    // A URL pointing at `minio:9000` is unreachable from the device.
    assert.ok(url?.startsWith("http://localhost:9000/"));
    assert.equal(url?.includes("minio:9000"), false);
  });

  it("omits the bucket segment when path style is off (real S3)", () => {
    process.env.NEXT_S3_FORCE_PATH_STYLE = "false";
    process.env.NEXT_S3_PUBLIC_ENDPOINT = "https://avatars.s3.amazonaws.com";

    assert.equal(
      buildAvatarUrl(`${USER_ID}/photo.jpg`),
      `https://avatars.s3.amazonaws.com/${USER_ID}/photo.jpg`,
    );
  });

  it("never doubles the slash when the endpoint has a trailing one", () => {
    process.env.NEXT_S3_PUBLIC_ENDPOINT = "http://localhost:9000/";
    assert.equal(
      buildAvatarUrl(`${USER_ID}/photo.jpg`),
      `http://localhost:9000/avatars/${USER_ID}/photo.jpg`,
    );
  });

  it("falls back to the internal endpoint when no public one is set", () => {
    delete process.env.NEXT_S3_PUBLIC_ENDPOINT;
    assert.equal(
      buildAvatarUrl(`${USER_ID}/photo.jpg`),
      `http://minio:9000/avatars/${USER_ID}/photo.jpg`,
    );
  });
});
