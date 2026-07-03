import type { AuthToken, Credentials } from "../types";

/** Simulated network latency until the real auth API exists. */
const MOCK_NETWORK_DELAY_MS = 800;

/**
 * Authenticates a user with email + password and returns an auth token.
 *
 * NOTE: mocked for now — it just waits and returns a fake token. When the real
 * backend lands, only this function changes; screens and stores stay the same.
 */
export async function loginUser(_credentials: Credentials): Promise<AuthToken> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return "mock-token-login";
}
