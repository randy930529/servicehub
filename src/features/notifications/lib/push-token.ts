import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { DevicePlatform, PushTokenResult } from "../domain/types";

/**
 * Getting a push token is device I/O — permissions, OS channels, a round-trip
 * to Expo's servers — so it lives here rather than in `domain/`, which stays
 * pure.
 */

/**
 * Android notification channel. Must match the backend's `channelId`
 * (`server/app/lib/notifications/expo-push.ts`): a message whose channel
 * doesn't exist is delivered silently, with no heads-up and no sound.
 */
export const DEFAULT_CHANNEL_ID = "default";

/**
 * On Android 13+ the permission prompt doesn't appear until a channel exists,
 * so this has to run *before* asking for permission or requesting a token.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: "Notificaciones",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#3c87f7",
  });
}

/** The EAS project the token is scoped to; without it Expo can't issue one. */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  );
}

/** Maps the RN platform onto the three the API accepts. */
export function currentPlatform(): DevicePlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/** Label sent with the registration so a user could tell devices apart. */
export function currentDeviceName(): string | null {
  return Device.deviceName ?? null;
}

/**
 * Reads the current permission without prompting — used by the UI to show
 * state, so opening a screen never triggers a system dialog on its own.
 */
export async function getPushPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Environments that can never produce a token, recognised from the error Expo
 * throws. Worth separating from a real failure: on Android, Expo Go simply
 * cannot do push since SDK 53, and telling the user "algo falló" would send
 * them debugging a problem that only a development build fixes.
 */
function unsupportedReason(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);

  if (/development build|Expo Go/i.test(message)) {
    return "Las notificaciones push necesitan un development build; Expo Go no puede recibirlas en Android.";
  }
  if (/must be a physical device|simulator|emulator/i.test(message)) {
    return "Este emulador no puede registrar notificaciones push. Usa uno con Google Play o un dispositivo real.";
  }
  return null;
}

/**
 * Asks for permission (if not already answered) and returns this device's Expo
 * push token.
 *
 * Never throws: every outcome — granted, denied, impossible here, broken — is a
 * value, because the caller runs this in the background at startup and an
 * unhandled rejection there would be invisible.
 */
export async function getExpoPushToken(): Promise<PushTokenResult> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) return { status: "denied" };

    const projectId = getProjectId();
    if (!projectId) {
      return {
        status: "unsupported",
        reason:
          "Falta el projectId de EAS en app.json; sin él Expo no puede emitir un token.",
      };
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: "granted", token: data };
  } catch (error) {
    const reason = unsupportedReason(error);
    if (reason) return { status: "unsupported", reason };

    console.error("Failed to get an Expo push token", error);
    return { status: "failed", error };
  }
}
