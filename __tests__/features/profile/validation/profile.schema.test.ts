import { describe, expect, test } from "@jest/globals";

import { ProfileSchema } from "@/features/profile/validation/profile.schema";

const VALID = {
  name: "Ana Pérez",
  bio: "Electricista con 10 años de experiencia.",
  phone: "+52 33 1234 5678",
};

describe("ProfileSchema", () => {
  test("accepts a complete, valid profile", () => {
    const result = ProfileSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  test("trims values before validating", () => {
    const result = ProfileSchema.safeParse({ ...VALID, name: "  Ana Pérez  " });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Ana Pérez");
  });

  test("rejects a name shorter than 2 characters", () => {
    const result = ProfileSchema.safeParse({ ...VALID, name: "A" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Mínimo 2 caracteres");
    }
  });

  test("rejects whitespace masquerading as a name", () => {
    expect(ProfileSchema.safeParse({ ...VALID, name: "   " }).success).toBe(
      false,
    );
  });

  test("rejects a name longer than 60 characters", () => {
    const result = ProfileSchema.safeParse({ ...VALID, name: "a".repeat(61) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Máximo 60 caracteres");
    }
  });

  test("rejects a bio longer than 280 characters", () => {
    const result = ProfileSchema.safeParse({ ...VALID, bio: "a".repeat(281) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Máximo 280 caracteres");
    }
  });

  test("accepts an empty bio and phone — both are optional in practice", () => {
    const result = ProfileSchema.safeParse({ ...VALID, bio: "", phone: "" });
    expect(result.success).toBe(true);
  });

  test("rejects a malformed phone", () => {
    const result = ProfileSchema.safeParse({ ...VALID, phone: "no-es-tel" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Ingresa un teléfono válido",
      );
    }
  });

  test("accepts common phone formats", () => {
    for (const phone of ["+523312345678", "33 1234 5678", "(33) 1234-5678"]) {
      expect(ProfileSchema.safeParse({ ...VALID, phone }).success).toBe(true);
    }
  });
});
