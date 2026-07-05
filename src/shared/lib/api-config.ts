/**
 * Base URL of the ServiceHub backend (`server/`).
 *
 * Override per environment with `EXPO_PUBLIC_API_URL`. Defaults to localhost,
 * which works for **web** and the **iOS simulator** out of the box.
 *
 * - Android emulator: set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`
 *   (the emulator reaches the host machine via 10.0.2.2, not localhost).
 * - Physical device: set your machine's LAN IP, e.g.
 *   `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000`.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:3000";

export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}
