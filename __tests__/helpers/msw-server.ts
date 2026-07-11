import { setupServer } from "msw/node";

import { getApiBaseUrl } from "@/shared/lib/api-config";

/**
 * MSW server for integration tests: intercepts the app's real HTTP requests
 * (axios → node http) at the network level, so use-case + query + screen run
 * unmocked against controlled API responses.
 *
 * Tests register handlers per case with `server.use(...)`; `resetHandlers()`
 * in `afterEach` keeps cases isolated.
 */
export const server = setupServer();

/** Absolute URL of an API path as the app would request it. */
export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}
