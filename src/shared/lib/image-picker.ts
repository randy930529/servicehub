import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * Picking and preparing an image is device I/O (permissions, system pickers,
 * native image processing), so it lives in `shared/lib` rather than in any
 * feature's `domain/`, which stays pure.
 *
 * Shared because two features need it — avatars and service photos — and
 * features must never import each other.
 */

/**
 * An image already cropped and compressed on-device, ready to be uploaded.
 * `contentType` has to match what the presigned URL is signed for.
 */
export interface PreparedImage {
  uri: string;
  contentType: string;
}

/**
 * Everything is normalized to JPEG, so the app only ever asks the API to sign
 * one content type — whatever the camera roll happened to hold (HEIC, PNG…).
 */
export const PREPARED_IMAGE_CONTENT_TYPE = "image/jpeg";

/** 0.8 keeps photos visually clean while cutting file size by ~10x. */
const DEFAULT_QUALITY = 0.8;

export type PrepareImageOptions = {
  /** Crop ratio enforced by the system editor, e.g. `[1, 1]` or `[4, 3]`. */
  aspect: [number, number];
  /** Longest edge after downscaling, in pixels. */
  maxWidth: number;
  /** JPEG quality, 0–1. */
  quality?: number;
};

export type PickImageResult =
  | { status: "picked"; image: PreparedImage }
  | { status: "canceled" }
  | { status: "denied" }
  /**
   * The picker or the native image processing threw. Reported instead of
   * rejecting so a failure always reaches the screen: an unhandled rejection
   * inside a press handler looks exactly like "the button does nothing".
   */
  | { status: "failed"; error: unknown };

/**
 * Downscales and compresses the picked image before it ever reaches the
 * network. A 6 MB camera photo comes out at a couple hundred KB, which is what
 * keeps uploads under the API's size limit.
 */
async function prepareImage(
  uri: string,
  options: PrepareImageOptions,
): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri).resize({
    width: options.maxWidth,
    // null keeps the aspect ratio — the crop already set it.
    height: null,
  });

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: options.quality ?? DEFAULT_QUALITY,
    format: SaveFormat.JPEG,
  });

  return { uri: saved.uri, contentType: PREPARED_IMAGE_CONTENT_TYPE };
}

/**
 * Turns a thrown error into a `failed` result.
 *
 * The native steps here — the system picker, the crop editor, the manipulator —
 * can all reject, and every one of those used to surface as an unhandled
 * rejection inside an `onPress`: no preview, no message, nothing to debug.
 */
function failed(error: unknown): PickImageResult {
  console.error("Image pick failed", error);
  return { status: "failed", error };
}

/** Opens the photo library with the system crop editor locked to `aspect`. */
export async function pickImageFromLibrary(
  options: PrepareImageOptions,
): Promise<PickImageResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // Android 13+/iOS 14+ hand back "limited" access for a partial grant. The
    // system picker works fine with it, so only a real denial is a denial.
    if (!permission.granted && permission.accessPrivileges !== "limited") {
      return { status: "denied" };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: options.aspect,
      // Compression is handled by the manipulator, so nothing is thrown away
      // twice: pick at full quality, compress once.
      quality: 1,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset) return { status: "canceled" };

    return { status: "picked", image: await prepareImage(asset.uri, options) };
  } catch (error) {
    return failed(error);
  }
}

/** Same flow, straight from the camera. */
export async function pickImageFromCamera(
  options: PrepareImageOptions,
): Promise<PickImageResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: "denied" };

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: options.aspect,
      quality: 1,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset) return { status: "canceled" };

    return { status: "picked", image: await prepareImage(asset.uri, options) };
  } catch (error) {
    return failed(error);
  }
}
