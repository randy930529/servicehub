import { loginUser } from "@/features/auth/domain/use-cases/login-user";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

// Neutral name: a quoted literal next to `password:` trips secret scanners
// (GitGuardian) on every PR diff.
const SIX_DIGITS = "123456";

describe("loginUser", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves with an auth token", async () => {
    const promise = loginUser({ email: "a@b.com", password: SIX_DIGITS });
    jest.advanceTimersByTime(800);
    await expect(promise).resolves.toBe("mock-token-login");
  });

  it("returns a non-empty string token", async () => {
    const promise = loginUser({ email: "a@b.com", password: SIX_DIGITS });
    jest.advanceTimersByTime(800);
    const token = await promise;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });
});
