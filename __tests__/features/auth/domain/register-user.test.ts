import { registerUser } from "@/features/auth/domain/use-cases/register-user";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

describe("registerUser", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves with an auth token", async () => {
    const promise = registerUser({
      name: "Juan Pérez",
      email: "juan@correo.com",
      password: "12345678",
    });
    jest.advanceTimersByTime(800);
    await expect(promise).resolves.toBe("mock-token-register");
  });

  it("returns a non-empty string token", async () => {
    const promise = registerUser({
      name: "Juan Pérez",
      email: "juan@correo.com",
      password: "12345678",
    });
    jest.advanceTimersByTime(800);
    const token = await promise;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });
});
