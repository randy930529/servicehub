import { isAxiosError } from "axios";

/**
 * Where a failed request went wrong:
 *
 * - `network` — the request never got a response (offline, DNS, timeout).
 * - `server`  — the backend answered with 5xx.
 * - `client`  — the backend answered with 4xx (bad request, auth, not found).
 * - `unknown` — anything else (e.g. a bug while mapping the response).
 */
export type ApiErrorKind = "network" | "server" | "client" | "unknown";

/**
 * Normalized API failure. The response interceptor in `api-client.ts` converts
 * every axios error into this, so use-cases, React Query and screens never
 * deal with raw axios shapes.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status of the response, or `null` when there was no response. */
  readonly status: number | null;

  constructor(message: string, kind: ApiErrorKind, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  /**
   * Whether retrying could help: transient failures (no connection, 5xx) are
   * retriable; 4xx and mapping bugs will fail the same way every time.
   */
  get isRetriable(): boolean {
    return this.kind === "network" || this.kind === "server";
  }
}

/** Converts any thrown value into an `ApiError` (idempotent). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    if (status === null) {
      return new ApiError(error.message || "Network error", "network");
    }
    return new ApiError(
      `Request failed with status ${status}`,
      status >= 500 ? "server" : "client",
      status,
    );
  }

  return new ApiError(
    error instanceof Error ? error.message : "Unknown error",
    "unknown",
  );
}
