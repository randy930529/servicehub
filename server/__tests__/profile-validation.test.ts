import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  AvatarConfirmSchema,
  UpdateProfileSchema,
  buildAvatarUploadRequestSchema,
} from "../app/lib/validation";

describe("UpdateProfileSchema", () => {
  it("accepts a partial update", () => {
    const result = UpdateProfileSchema.safeParse({ name: "Ana Pérez" });
    assert.ok(result.success);
    assert.deepEqual(result.data, { name: "Ana Pérez" });
  });

  it("accepts every field at once", () => {
    const result = UpdateProfileSchema.safeParse({
      name: "Ana Pérez",
      bio: "Electricista",
      phone: "+52 33 1234 5678",
    });
    assert.ok(result.success);
  });

  it("rejects an empty body — a PATCH must change something", () => {
    assert.equal(UpdateProfileSchema.safeParse({}).success, false);
  });

  it("trims before validating, so whitespace can't pass as a name", () => {
    const result = UpdateProfileSchema.safeParse({ name: "  A  " });
    assert.equal(result.success, false);
  });

  it("trims accepted values", () => {
    const result = UpdateProfileSchema.safeParse({ name: "  Ana Pérez  " });
    assert.ok(result.success);
    assert.equal(result.data.name, "Ana Pérez");
  });

  it("enforces the name length bounds", () => {
    assert.equal(UpdateProfileSchema.safeParse({ name: "A" }).success, false);
    assert.equal(
      UpdateProfileSchema.safeParse({ name: "a".repeat(61) }).success,
      false,
    );
    assert.ok(UpdateProfileSchema.safeParse({ name: "a".repeat(60) }).success);
  });

  it("caps the bio at 280 characters", () => {
    assert.ok(UpdateProfileSchema.safeParse({ bio: "a".repeat(280) }).success);
    assert.equal(
      UpdateProfileSchema.safeParse({ bio: "a".repeat(281) }).success,
      false,
    );
  });

  it("allows clearing bio and phone with an empty string", () => {
    assert.ok(UpdateProfileSchema.safeParse({ bio: "", phone: "" }).success);
  });

  it("rejects a phone that isn't shaped like one", () => {
    assert.equal(
      UpdateProfileSchema.safeParse({ phone: "not-a-phone" }).success,
      false,
    );
    assert.equal(UpdateProfileSchema.safeParse({ phone: "123" }).success, false);
  });

  it("accepts common phone formats", () => {
    for (const phone of ["+523312345678", "33 1234 5678", "(33) 1234-5678"]) {
      assert.ok(
        UpdateProfileSchema.safeParse({ phone }).success,
        `expected ${phone} to be valid`,
      );
    }
  });

  it("ignores unknown fields instead of writing them", () => {
    const result = UpdateProfileSchema.safeParse({
      name: "Ana Pérez",
      role: "admin",
    });
    assert.ok(result.success);
    assert.equal("role" in result.data, false);
  });
});

describe("avatar upload request", () => {
  beforeEach(() => {
    delete process.env.NEXT_AVATAR_MAX_BYTES;
  });

  it("accepts a supported type within the size limit", () => {
    const result = buildAvatarUploadRequestSchema().safeParse({
      contentType: "image/jpeg",
      size: 184320,
    });
    assert.ok(result.success);
  });

  it("rejects an unsupported image type", () => {
    const result = buildAvatarUploadRequestSchema().safeParse({
      contentType: "image/svg+xml",
      size: 1024,
    });
    assert.equal(result.success, false);
  });

  it("rejects a size over the limit", () => {
    const result = buildAvatarUploadRequestSchema().safeParse({
      contentType: "image/jpeg",
      // Default limit is 5 MB.
      size: 5 * 1024 * 1024 + 1,
    });
    assert.equal(result.success, false);
  });

  it("reads the limit from the environment at call time", () => {
    process.env.NEXT_AVATAR_MAX_BYTES = "2048";
    const schema = buildAvatarUploadRequestSchema();

    assert.ok(schema.safeParse({ contentType: "image/png", size: 2048 }).success);
    assert.equal(
      schema.safeParse({ contentType: "image/png", size: 2049 }).success,
      false,
    );
  });

  it("rejects a zero or negative size", () => {
    const schema = buildAvatarUploadRequestSchema();
    assert.equal(
      schema.safeParse({ contentType: "image/jpeg", size: 0 }).success,
      false,
    );
    assert.equal(
      schema.safeParse({ contentType: "image/jpeg", size: -1 }).success,
      false,
    );
  });
});

describe("AvatarConfirmSchema", () => {
  it("accepts a key", () => {
    const result = AvatarConfirmSchema.safeParse({
      key: "665f1b2c9a1b2c3d4e5f6a7b/a1b2.jpg",
    });
    assert.ok(result.success);
  });

  it("rejects an empty or missing key", () => {
    assert.equal(AvatarConfirmSchema.safeParse({ key: "" }).success, false);
    assert.equal(AvatarConfirmSchema.safeParse({}).success, false);
  });

  it("rejects an absurdly long key", () => {
    assert.equal(
      AvatarConfirmSchema.safeParse({ key: "a".repeat(257) }).success,
      false,
    );
  });
});
