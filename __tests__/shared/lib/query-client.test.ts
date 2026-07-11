import { ApiError } from "@/shared/lib/api-error";
import { createQueryClient } from "@/shared/lib/query-client";

type RetryFn = (failureCount: number, error: Error) => boolean;

function getRetry(): RetryFn {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  expect(typeof retry).toBe("function");
  return retry as RetryFn;
}

describe("createQueryClient retry policy", () => {
  test("retries transient failures up to 2 times", () => {
    const retry = getRetry();
    const networkError = new ApiError("offline", "network");
    const serverError = new ApiError("boom", "server", 500);

    expect(retry(0, networkError)).toBe(true);
    expect(retry(1, serverError)).toBe(true);
    expect(retry(2, networkError)).toBe(false);
  });

  test("never retries client (4xx) errors", () => {
    const retry = getRetry();

    expect(retry(0, new ApiError("not found", "client", 404))).toBe(false);
  });

  test("never retries unknown errors", () => {
    const retry = getRetry();

    expect(retry(0, new ApiError("mapping bug", "unknown"))).toBe(false);
  });

  test("retries plain errors that predate normalization", () => {
    const retry = getRetry();

    expect(retry(0, new Error("legacy"))).toBe(true);
    expect(retry(2, new Error("legacy"))).toBe(false);
  });
});
