import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

import { ApiError, toApiError } from "@/shared/lib/api-error";

function axiosErrorWithStatus(status: number): AxiosError {
  const response = { status } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    undefined,
    { headers: new AxiosHeaders() },
    undefined,
    response,
  );
}

describe("toApiError", () => {
  test("maps an axios error without response to a network error", () => {
    const error = toApiError(
      new AxiosError("Network Error", AxiosError.ERR_NETWORK),
    );

    expect(error.kind).toBe("network");
    expect(error.status).toBeNull();
    expect(error.isRetriable).toBe(true);
  });

  test("maps a 5xx response to a retriable server error", () => {
    const error = toApiError(axiosErrorWithStatus(503));

    expect(error.kind).toBe("server");
    expect(error.status).toBe(503);
    expect(error.isRetriable).toBe(true);
  });

  test("maps a 4xx response to a non-retriable client error", () => {
    const error = toApiError(axiosErrorWithStatus(404));

    expect(error.kind).toBe("client");
    expect(error.status).toBe(404);
    expect(error.isRetriable).toBe(false);
  });

  test("maps a non-axios error to a non-retriable unknown error", () => {
    const error = toApiError(new TypeError("cannot read properties"));

    expect(error.kind).toBe("unknown");
    expect(error.status).toBeNull();
    expect(error.isRetriable).toBe(false);
    expect(error.message).toBe("cannot read properties");
  });

  test("returns an ApiError unchanged (idempotent)", () => {
    const original = new ApiError("boom", "server", 500);

    expect(toApiError(original)).toBe(original);
  });
});
