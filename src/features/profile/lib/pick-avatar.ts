import {
  PREPARED_IMAGE_CONTENT_TYPE,
  pickImageFromCamera,
  pickImageFromLibrary,
  type PickImageResult,
} from "@/shared/lib/image-picker";

/**
 * Avatar-specific settings for the shared image picker: a square crop, small
 * enough that the upload stays far below the API's size limit.
 */

/** Avatars render at most ~96pt; 512px covers every density with room to spare. */
const AVATAR_SIZE = 512;

const AVATAR_PICK_OPTIONS = {
  aspect: [1, 1] as [number, number],
  maxWidth: AVATAR_SIZE,
};

/** The single content type the API is ever asked to sign for an avatar. */
export const AVATAR_CONTENT_TYPE = PREPARED_IMAGE_CONTENT_TYPE;

export type PickAvatarResult = PickImageResult;

/** Opens the photo library, with the system crop editor locked to a square. */
export function pickAvatarFromLibrary(): Promise<PickAvatarResult> {
  return pickImageFromLibrary(AVATAR_PICK_OPTIONS);
}

/** Same flow, straight from the camera. */
export function pickAvatarFromCamera(): Promise<PickAvatarResult> {
  return pickImageFromCamera(AVATAR_PICK_OPTIONS);
}
