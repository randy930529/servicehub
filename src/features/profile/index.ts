// Public API of the profile feature. Import from here, not from internal paths.

// Screens
export { EditProfileScreen } from "./screens/edit-profile-screen";
export { ProfileScreen } from "./screens/profile-screen";

// Components
export { Avatar, getInitials } from "./components/avatar";

// Domain (types + use-cases)
export * from "./domain";

// Queries
export { profileKeys } from "./queries/keys";
export {
  useRemoveAvatarMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "./queries/use-profile-mutations";
export { useProfileQuery } from "./queries/use-profile-query";

// Validation
export { ProfileSchema, type ProfileForm } from "./validation/profile.schema";
