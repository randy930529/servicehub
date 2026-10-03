import * as Notifications from "expo-notifications";

/**
 * Decides what happens to a notification that arrives while the app is open.
 *
 * Without this, a push received in the foreground is delivered silently: the
 * OS assumes an app you're looking at will show it itself. Banner + list keeps
 * behaviour the same whether or not the user happens to be in the app.
 *
 * Called at module scope from the root layout, before any notification can be
 * handled.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      // Badges are a commitment to keeping the count correct; nothing in the
      // app clears them yet, so a stale number would be worse than none.
      shouldSetBadge: false,
    }),
  });
}
