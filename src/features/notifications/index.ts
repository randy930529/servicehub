// Public API of the notifications feature.

// Screens
export { NotificationsScreen } from "./screens/notifications-screen";

// Hooks — both are mounted by the app layer (`app/_layout.tsx`), which is the
// only place allowed to know about the session and the navigation tree.
export { useNotificationObserver } from "./hooks/use-notification-observer";
export { usePushRegistration } from "./hooks/use-push-registration";

// Stores
export { usePushStore, type PushRegistrationStatus } from "./stores/push.store";

// Queries
export { useTestNotificationMutation } from "./queries/use-test-notification-mutation";

// Device I/O
export { configureNotificationHandler } from "./lib/notification-handler";
export { resolveNotificationRoute } from "./lib/notification-route";
export { DEFAULT_CHANNEL_ID } from "./lib/push-token";

// Domain (types + use-cases)
export * from "./domain";
