import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { PreparedImage } from "../domain/types";

/**
 * Picking an avatar is device I/O (permissions, system pickers, native image
 * processing), so it lives here rather than in `domain/`, which stays pure.
 */

/** Avatars render at most ~96pt; 512px covers every density with room to spare. */
const AVATAR_SIZE = 512;

/** 0.8 keeps portraits visually clean while cutting file size by ~10x. */
const JPEG_QUALITY = 0.8;

/**
 * Everything is normalized to JPEG, so the app only ever asks the API to sign
 * one content type — whatever the camera roll happened to hold (HEIC, PNG…).
 */
export const AVATAR_CONTENT_TYPE = "image/jpeg";

export type PickAvatarResult =
  | { status: "picked"; image: PreparedImage }
  | { status: "canceled" }
  | { status: "denied" };

/**
 * Crops (1:1, via the system editor), downscales and compresses the picked
 * image before it ever reaches the network. A 6 MB camera photo comes out at a
 * couple hundred KB, which is what keeps the upload under the size limit.
 */
async function prepareAvatar(uri: string): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri).resize({
    width: AVATAR_SIZE,
    // null keeps the aspect ratio — the crop already made it square.
    height: null,
  });

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  return { uri: saved.uri, contentType: AVATAR_CONTENT_TYPE };
}

/** Opens the photo library, with the system crop editor locked to a square. */
export async function pickAvatarFromLibrary(): Promise<PickAvatarResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    // Compression is handled by the manipulator below, so nothing is thrown
    // away twice: pick at full quality, compress once.
    quality: 1,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset) return { status: "canceled" };

  return { status: "picked", image: await prepareAvatar(asset.uri) };
}

/** Same flow, straight from the camera. */
export async function pickAvatarFromCamera(): Promise<PickAvatarResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset) return { status: "canceled" };

  return { status: "picked", image: await prepareAvatar(asset.uri) };
}
