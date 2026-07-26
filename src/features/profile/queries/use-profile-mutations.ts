import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from "../domain/use-cases";
import type { PreparedImage, ProfileUpdate, UserProfile } from "../domain/types";
import { profileKeys } from "./keys";

/**
 * Every profile mutation answers with the full, server-normalized profile, so
 * the cache is written directly instead of invalidated — the screen updates
 * without a second round-trip.
 */
function useProfileCacheWriter() {
  const queryClient = useQueryClient();

  return (profile: UserProfile) => {
    queryClient.setQueryData(profileKeys.me(), profile);
  };
}

/** Saves name/bio/phone. */
export function useUpdateProfileMutation() {
  const writeProfile = useProfileCacheWriter();

  return useMutation({
    mutationFn: (changes: ProfileUpdate) => updateProfile(changes),
    onSuccess: writeProfile,
  });
}

/** Runs the three-step presigned upload and attaches the new avatar. */
export function useUploadAvatarMutation() {
  const writeProfile = useProfileCacheWriter();

  return useMutation({
    mutationFn: (image: PreparedImage) => uploadAvatar(image),
    onSuccess: writeProfile,
  });
}

/** Clears the avatar, falling back to the initials placeholder. */
export function useRemoveAvatarMutation() {
  const writeProfile = useProfileCacheWriter();

  return useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: writeProfile,
  });
}
