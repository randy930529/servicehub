import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CreateServiceSchema,
  SERVICE_PRICE_MAX_CENTS,
  UpdateServiceSchema,
} from "../app/lib/validation/service";

const VALID = {
  name: "Limpieza de hogar",
  description: "Limpieza profunda de tu casa o departamento, por horas.",
  category: "hogar" as const,
  priceFromCents: 45000,
};

/** Field paths that failed, so assertions don't depend on message wording. */
function failedFields(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join("."));
}

describe("CreateServiceSchema", () => {
  it("accepts a minimal valid service", () => {
    const result = CreateServiceSchema.safeParse(VALID);
    assert.ok(result.success);
    assert.equal(result.data.name, VALID.name);
  });

  it("trims whitespace before measuring length", () => {
    const result = CreateServiceSchema.safeParse({ ...VALID, name: "  Podado  " });
    assert.ok(result.success);
    assert.equal(result.data.name, "Podado");
  });

  it("requires the core fields", () => {
    const result = CreateServiceSchema.safeParse({});
    assert.equal(result.success, false);

    const fields = failedFields(result);
    for (const field of ["name", "description", "category", "priceFromCents"]) {
      assert.ok(fields.includes(field), `expected ${field} to fail`);
    }
  });

  it("rejects a name that is too short or too long", () => {
    assert.equal(CreateServiceSchema.safeParse({ ...VALID, name: "ab" }).success, false);
    assert.equal(
      CreateServiceSchema.safeParse({ ...VALID, name: "a".repeat(81) }).success,
      false,
    );
  });

  it("rejects a description below the useful minimum", () => {
    assert.equal(
      CreateServiceSchema.safeParse({ ...VALID, description: "Corto" }).success,
      false,
    );
  });

  it("rejects an unknown category", () => {
    assert.equal(
      CreateServiceSchema.safeParse({ ...VALID, category: "submarinismo" }).success,
      false,
    );
  });

  it("rejects prices that are negative, fractional or absurd", () => {
    // Cents are integers by definition: a fractional cent is a bug upstream.
    assert.equal(
      CreateServiceSchema.safeParse({ ...VALID, priceFromCents: 4500.5 }).success,
      false,
    );
    assert.equal(
      CreateServiceSchema.safeParse({ ...VALID, priceFromCents: -1 }).success,
      false,
    );
    assert.equal(
      CreateServiceSchema.safeParse({
        ...VALID,
        priceFromCents: SERVICE_PRICE_MAX_CENTS + 1,
      }).success,
      false,
    );
  });

  it("accepts a free service", () => {
    assert.ok(
      CreateServiceSchema.safeParse({ ...VALID, priceFromCents: 0 }).success,
    );
  });

  it("accepts a location in human order and rejects impossible coordinates", () => {
    assert.ok(
      CreateServiceSchema.safeParse({
        ...VALID,
        location: { lat: 20.6597, lng: -103.3496 },
      }).success,
    );
    assert.equal(
      CreateServiceSchema.safeParse({
        ...VALID,
        location: { lat: 120, lng: -103.3496 },
      }).success,
      false,
    );
  });

  it("allows an explicitly null location and image", () => {
    const result = CreateServiceSchema.safeParse({
      ...VALID,
      location: null,
      imageKey: null,
    });
    assert.ok(result.success);
  });
});

describe("UpdateServiceSchema", () => {
  it("accepts a single-field change", () => {
    const result = UpdateServiceSchema.safeParse({ priceFromCents: 50000 });
    assert.ok(result.success);
  });

  it("rejects an empty body — a PATCH must change something", () => {
    const result = UpdateServiceSchema.safeParse({});
    assert.equal(result.success, false);
    // Object-level issues carry an empty path; the handler groups them under `_`.
    assert.ok(failedFields(result).includes(""));
  });

  it("still enforces the field rules it does receive", () => {
    assert.equal(UpdateServiceSchema.safeParse({ name: "ab" }).success, false);
  });

  it("accepts clearing the image with an explicit null", () => {
    assert.ok(UpdateServiceSchema.safeParse({ imageKey: null }).success);
  });
});
