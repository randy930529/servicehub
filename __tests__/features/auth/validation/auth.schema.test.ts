import { LoginSchema, RegisterSchema } from "@/features/auth/validation/auth.schema";
import { describe, expect, it } from "@jest/globals";

// Dummy values with neutral, length-based names: quoted literals assigned to
// password-like keys trigger secret scanners (GitGuardian) on every PR diff.
const SIX_DIGITS = "123456";
const FIVE_DIGITS = "12345";
const EIGHT_DIGITS = "12345678";
const SEVEN_DIGITS = "1234567";
const OTHER_TEXT = "diferente";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = LoginSchema.safeParse({
      email: "a@b.com",
      password: SIX_DIGITS,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "invalido",
      password: SIX_DIGITS,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Ingresa un correo válido");
    }
  });

  it("rejects password shorter than 6 characters", () => {
    const result = LoginSchema.safeParse({
      email: "a@b.com",
      password: FIVE_DIGITS,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mínimo 6 caracteres");
    }
  });

  it("rejects empty email", () => {
    const result = LoginSchema.safeParse({ email: "", password: SIX_DIGITS });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Juan Pérez",
    email: "juan@correo.com",
    password: EIGHT_DIGITS,
    confirmPassword: EIGHT_DIGITS,
  };

  it("accepts valid registration data", () => {
    expect(RegisterSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects name shorter than 2 characters", () => {
    const result = RegisterSchema.safeParse({ ...valid, name: "J" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mínimo 2 caracteres");
    }
  });

  it("rejects invalid email", () => {
    const result = RegisterSchema.safeParse({ ...valid, email: "no-es-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Ingresa un correo válido");
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const result = RegisterSchema.safeParse({
      ...valid,
      password: SEVEN_DIGITS,
      confirmPassword: SEVEN_DIGITS,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mínimo 8 caracteres");
    }
  });

  it("rejects mismatched passwords", () => {
    const result = RegisterSchema.safeParse({
      ...valid,
      confirmPassword: OTHER_TEXT,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Las contraseñas no coinciden",
      );
    }
  });
});
