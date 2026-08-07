import {
  PREPARED_IMAGE_CONTENT_TYPE,
  pickImageFromLibrary,
  type PickImageResult,
} from "@/shared/lib/image-picker";

/**
 * Service-photo settings for the shared image picker.
 *
 * 4:3 rather than the avatar's square: service cards render a landscape
 * banner, and cropping to the final shape up front avoids the API storing
 * pixels that will never be shown.
 */
const SERVICE_IMAGE_WIDTH = 1024;

const SERVICE_IMAGE_OPTIONS = {
  aspect: [4, 3] as [number, number],
  maxWidth: SERVICE_IMAGE_WIDTH,
};

/** The single content type the API is ever asked to sign for a service photo. */
export const SERVICE_IMAGE_CONTENT_TYPE = PREPARED_IMAGE_CONTENT_TYPE;

export type PickServiceImageResult = PickImageResult;

/** Opens the photo library with the system crop editor locked to 4:3. */
export function pickServiceImageFromLibrary(): Promise<PickServiceImageResult> {
  return pickImageFromLibrary(SERVICE_IMAGE_OPTIONS);
}
