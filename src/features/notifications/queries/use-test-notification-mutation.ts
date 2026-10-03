import { useMutation } from "@tanstack/react-query";

import { sendTestNotification } from "../domain/use-cases";

/**
 * Fires the backend's test push. Nothing to cache — the result is a one-off
 * report of how the send went, not state the app keeps.
 */
export function useTestNotificationMutation() {
  return useMutation({
    mutationFn: (options?: { title?: string; body?: string; url?: string }) =>
      sendTestNotification(options),
  });
}
