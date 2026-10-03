import { apiClient } from "@/shared/lib/api-client";

import type { DeviceRegistration, RegisteredDevice } from "../types";

interface ApiDeviceResponse {
  device: RegisteredDevice;
}

/**
 * Registers (or refreshes) this device's push token for the signed-in user.
 *
 * Safe to call on every launch: the API upserts by token, so re-registering
 * only bumps `lastSeenAt` — and signing in on a shared device moves the token
 * to whoever is signed in now.
 */
export async function registerDevice(
  registration: DeviceRegistration,
): Promise<RegisteredDevice> {
  const { data } = await apiClient.post<ApiDeviceResponse>(
    "/api/users/me/devices",
    {
      token: registration.token,
      platform: registration.platform,
      deviceName: registration.deviceName ?? null,
    },
  );
  return data.device;
}
