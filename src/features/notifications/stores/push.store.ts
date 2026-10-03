import { create } from "zustand";

import { registerDevice, unregisterDevice } from "../domain/use-cases";
import {
  currentDeviceName,
  currentPlatform,
  getExpoPushToken,
} from "../lib/push-token";

/**
 * State of this device's push registration.
 *
 * UI state, not server state, which is why it's Zustand and not React Query:
 * there is exactly one device here, it has no cache key, and the screen only
 * ever asks "did this phone manage to register, and if not, why".
 */
export type PushRegistrationStatus =
  | "idle"
  | "registering"
  | "registered"
  | "denied"
  | "unsupported"
  | "failed";

type PushState = {
  status: PushRegistrationStatus;
  /** The Expo push token, once we have one. */
  token: string | null;
  /** Human-readable explanation for `unsupported` / `failed` / `denied`. */
  reason: string | null;
  /** Asks for permission if needed and registers the token with the API. */
  register: () => Promise<void>;
  /** Stops notifications for this device and forgets the token. */
  unregister: () => Promise<void>;
};

export const usePushStore = create<PushState>((set, get) => ({
  status: "idle",
  token: null,
  reason: null,

  register: async () => {
    // Already done, or already in flight: registering twice would just bump
    // `lastSeenAt` and race the first attempt.
    const { status } = get();
    if (status === "registering" || status === "registered") return;

    set({ status: "registering", reason: null });

    const result = await getExpoPushToken();

    if (result.status === "denied") {
      set({
        status: "denied",
        token: null,
        reason:
          "No podrás recibir avisos hasta que actives las notificaciones para ServiceHub.",
      });
      return;
    }

    if (result.status === "unsupported") {
      set({ status: "unsupported", token: null, reason: result.reason });
      return;
    }

    if (result.status === "failed") {
      set({
        status: "failed",
        token: null,
        reason: "No pudimos preparar las notificaciones en este dispositivo.",
      });
      return;
    }

    try {
      await registerDevice({
        token: result.token,
        platform: currentPlatform(),
        deviceName: currentDeviceName(),
      });
      set({ status: "registered", token: result.token, reason: null });
    } catch {
      // The token is real, the server just didn't take it. Keeping it lets a
      // later retry skip the permission round-trip.
      set({
        status: "failed",
        token: result.token,
        reason: "No pudimos registrar este dispositivo. Inténtalo de nuevo.",
      });
    }
  },

  unregister: async () => {
    const { token } = get();
    set({ status: "idle", token: null, reason: null });

    // Best-effort: signing out locally must not depend on the network.
    if (token) {
      void unregisterDevice(token).catch(() => undefined);
    }
  },
}));
