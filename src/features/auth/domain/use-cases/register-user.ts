import type { AuthToken, RegistrationData } from "../types";

/** Simulated network latency until the real auth API exists. */
const MOCK_NETWORK_DELAY_MS = 800;

/**
 * Creates a new account and returns an auth token for the new session.
 *
 * NOTE: mocked for now — it just waits and returns a fake token. When the real
 * backend lands, only this function changes; screens and stores stay the same.
 */
export async function registerUser(
  _data: RegistrationData,
): Promise<AuthToken> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return "mock-token-register";
}
