import { z } from "zod";

import { DEVICE_PLATFORMS } from "@/app/lib/models";

/**
 * Server-side validation for the push notification endpoints.
 *
 * The app mirrors these rules for instant feedback, but the API can never
 * trust that: these are the ones protecting the database.
 */

/**
 * Shape of an Expo push token: `ExponentPushToken[...]` (the historical form
 * Expo still issues) or `ExpoPushToken[...]`.
 *
 * Checked here rather than only at send time so a malformed token never
 * reaches the collection — every send to it would fail forever otherwise.
 */
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\s[\]]+\]$/;

export function isExpoPushToken(value: string): boolean {
  return EXPO_PUSH_TOKEN_PATTERN.test(value);
}

const pushTokenField = z
  .string()
  .trim()
  .refine(isExpoPushToken, { message: "Not an Expo push token" });

/** `POST /api/users/me/devices`. */
export const RegisterDeviceSchema = z.object({
  token: pushTokenField,
  platform: z.enum(DEVICE_PLATFORMS),
  deviceName: z.string().trim().max(80).nullable().optional(),
});

export type RegisterDeviceInputType = z.infer<typeof RegisterDeviceSchema>;

/** `DELETE /api/users/me/devices` — sign-out on this device only. */
export const UnregisterDeviceSchema = z.object({
  token: pushTokenField,
});

export type UnregisterDeviceInputType = z.infer<typeof UnregisterDeviceSchema>;

/**
 * Deep-link target carried by a notification.
 *
 * Only in-app paths are accepted. Letting a notification carry an absolute URL
 * would turn every push into a way to bounce the user somewhere else entirely;
 * the app applies the same rule again before navigating.
 */
export const NotificationUrlSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Must be an in-app path, e.g. /my-services",
  });

/** `POST /api/notifications/test` — everything optional, sane defaults. */
export const SendTestNotificationSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  body: z.string().trim().min(1).max(240).optional(),
  url: NotificationUrlSchema.optional(),
});

export type SendTestNotificationInputType = z.infer<
  typeof SendTestNotificationSchema
>;
