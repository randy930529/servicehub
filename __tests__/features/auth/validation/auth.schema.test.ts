import { LoginSchema, RegisterSchema } from "@/features/auth/validation/auth.schema";
import { describe, expect, it } from "@jest/globals";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = LoginSchema.safeParse({
      email: "a@b.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "invalido",
      password: "123456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Ingresa un correo válido");
    }
  });

  it("rejects password shorter than 6 characters", () => {
    const result = LoginSchema.safeParse({
      email: "a@b.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mínimo 6 caracteres");
    }
  });

  it("rejects empty email", () => {
    const result = LoginSchema.safeParse({ email: "", password: "123456" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Juan Pérez",
    email: "juan@correo.com",
    password: "12345678",
    confirmPassword: "12345678",
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
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mínimo 8 caracteres");
    }
  });

  it("rejects mismatched passwords", () => {
    const result = RegisterSchema.safeParse({
      ...valid,
      confirmPassword: "diferente",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Las contraseñas no coinciden",
      );
    }
  });
});
