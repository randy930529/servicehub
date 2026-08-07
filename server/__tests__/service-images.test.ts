import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  buildServiceImageKey,
  buildServiceImageUrl,
  isOwnedServiceImageKey,
} from "../app/lib/storage/service-images";

const USER_ID = "665f1b2c9a1b2c3d4e5f6a7b";
const OTHER_USER_ID = "665f1b2c9a1b2c3d4e5f6a7c";

function setStorageEnv() {
  process.env.NEXT_S3_ENDPOINT = "http://minio:9000";
  process.env.NEXT_S3_PUBLIC_ENDPOINT = "http://localhost:9000";
  process.env.NEXT_S3_BUCKET = "avatars";
  process.env.NEXT_S3_SERVICE_IMAGES_BUCKET = "service-images";
  process.env.NEXT_S3_ACCESS_KEY_ID = "test-key";
  process.env.NEXT_S3_SECRET_ACCESS_KEY = "test-secret";
  delete process.env.NEXT_S3_FORCE_PATH_STYLE;
  delete process.env.NEXT_S3_SERVICE_IMAGES_PUBLIC_ENDPOINT;
}

describe("buildServiceImageKey", () => {
  beforeEach(setStorageEnv);

  it("namespaces by owner, not by service", () => {
    // The image is uploaded before the service exists, so there is no service
    // id yet — and the owner prefix is what the confirm step can verify.
    const key = buildServiceImageKey(USER_ID, "image/jpeg");
    assert.ok(key.startsWith(`${USER_ID}/`));
    assert.ok(key.endsWith(".jpg"));
  });

  it("never reuses a key, so a replaced photo can't hit a stale cache", () => {
    assert.notEqual(
      buildServiceImageKey(USER_ID, "image/jpeg"),
      buildServiceImageKey(USER_ID, "image/jpeg"),
    );
  });

  it("refuses an unsupported content type", () => {
    assert.throws(
      () => buildServiceImageKey(USER_ID, "image/svg+xml"),
      /Unsupported service image content type/,
    );
  });
});

describe("isOwnedServiceImageKey", () => {
  it("accepts the caller's own key and rejects everyone else's", () => {
    assert.ok(
      isOwnedServiceImageKey(buildServiceImageKey(USER_ID, "image/png"), USER_ID),
    );
    assert.equal(
      isOwnedServiceImageKey(
        buildServiceImageKey(OTHER_USER_ID, "image/png"),
        USER_ID,
      ),
      false,
    );
  });

  it("rejects path traversal out of the user's prefix", () => {
    assert.equal(
      isOwnedServiceImageKey(`${USER_ID}/../${OTHER_USER_ID}/x.jpg`, USER_ID),
      false,
    );
    assert.equal(isOwnedServiceImageKey(`${USER_ID}//secret.jpg`, USER_ID), false);
  });
});

describe("buildServiceImageUrl", () => {
  beforeEach(setStorageEnv);

  it("returns null when the service has no photo", () => {
    assert.equal(buildServiceImageUrl(null), null);
    assert.equal(buildServiceImageUrl(undefined), null);
    assert.equal(buildServiceImageUrl(""), null);
  });

  it("points at the service bucket, not the avatars one", () => {
    assert.equal(
      buildServiceImageUrl(`${USER_ID}/photo.jpg`),
      `http://localhost:9000/service-images/${USER_ID}/photo.jpg`,
    );
  });

  it("uses the public endpoint, never the internal one", () => {
    const url = buildServiceImageUrl(`${USER_ID}/photo.jpg`);
    assert.equal(url?.includes("minio:9000"), false);
  });

  it("honours a per-bucket public endpoint (virtual-hosted S3)", () => {
    process.env.NEXT_S3_FORCE_PATH_STYLE = "false";
    process.env.NEXT_S3_SERVICE_IMAGES_PUBLIC_ENDPOINT =
      "https://service-images.s3.amazonaws.com";

    assert.equal(
      buildServiceImageUrl(`${USER_ID}/photo.jpg`),
      `https://service-images.s3.amazonaws.com/${USER_ID}/photo.jpg`,
    );
  });
});
