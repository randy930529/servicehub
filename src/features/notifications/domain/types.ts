/**
 * Notifications domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer.
 * No React, no UI, no persistence concerns here.
 */

export type DevicePlatform = "ios" | "android" | "web";

/** What the app sends when it registers this device for push. */
export interface DeviceRegistration {
  /** Expo push token, e.g. `ExponentPushToken[xxxxxxxx]`. */
  token: string;
  platform: DevicePlatform;
  deviceName?: string | null;
}

/** A device as the API reports it back. */
export interface RegisteredDevice {
  token: string;
  platform: DevicePlatform;
  deviceName: string | null;
  lastSeenAt: string;
}

/**
 * Why the app does or doesn't have a push token.
 *
 * `unsupported` is its own case rather than an error: push needs a development
 * build and real notification credentials, so a simulator or Expo Go on Android
 * legitimately can't produce a token and the UI should say so instead of
 * showing a failure.
 */
export type PushTokenResult =
  | { status: "granted"; token: string }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; error: unknown };

/** Outcome of the backend's test push. */
export interface TestNotificationResult {
  sent: number;
  failed: number;
  devices: number;
  removedTokens: number;
}
