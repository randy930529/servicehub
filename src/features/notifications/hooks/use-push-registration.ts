import { useEffect } from "react";

import { usePushStore } from "../stores/push.store";

/**
 * Keeps this device's push registration in step with the session.
 *
 * `enabled` is passed in rather than read from the auth store: features must
 * not import each other, so the app layer — which may know about both — is what
 * connects the two.
 *
 * Registering is deliberately tied to being signed in. A push token is only
 * useful once the API knows who owns it, and asking for notification permission
 * before someone has an account is the prompt users reflexively decline.
 */
export function usePushRegistration(enabled: boolean) {
  const register = usePushStore((state) => state.register);
  const unregister = usePushStore((state) => state.unregister);

  useEffect(() => {
    if (enabled) {
      void register();
      return;
    }
    // Session ended (sign-out, or a refresh token that couldn't be renewed):
    // stop this device from receiving pushes meant for that account.
    void unregister();
  }, [enabled, register, unregister]);
}
