import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect } from "react";

import { resolveNotificationRoute } from "../lib/notification-route";

/**
 * Opens the screen a tapped notification points at.
 *
 * Two paths, both needed: `getLastNotificationResponse` covers the app being
 * launched *by* the notification (the listener would be registered too late to
 * see it), and the listener covers taps while the app is already running.
 *
 * Mount once, at the root layout — the navigation tree has to exist before
 * `router.push` can go anywhere.
 */
export function useNotificationObserver() {
  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const route = resolveNotificationRoute(
        notification.request.content.data,
      );
      // Typed routes can't check a string that only exists at runtime; the
      // allowlist in `resolveNotificationRoute` is what makes the cast safe.
      if (route) router.push(route as Href);
    }

    const launchedBy = Notifications.getLastNotificationResponse();
    if (launchedBy?.notification) redirect(launchedBy.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => redirect(response.notification),
    );

    return () => subscription.remove();
  }, []);
}
