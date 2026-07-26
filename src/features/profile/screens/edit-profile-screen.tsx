import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { TextInput } from "@/shared/components/ui/text-input";
import { Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";

import { Avatar } from "../components/avatar";
import { pickAvatarFromLibrary } from "../lib/pick-avatar";
import {
  useRemoveAvatarMutation,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "../queries/use-profile-mutations";
import { useProfileQuery } from "../queries/use-profile-query";
import { ProfileSchema, type ProfileForm } from "../validation/profile.schema";

export function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: profile, isPending } = useProfileQuery();

  const updateProfileMutation = useUpdateProfileMutation();
  const uploadAvatarMutation = useUploadAvatarMutation();
  const removeAvatarMutation = useRemoveAvatarMutation();

  /** Feedback for the avatar actions, which save on their own (no submit). */
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { name: "", bio: "", phone: "" },
    // Prefill once the query resolves, without waiting for it to render.
    values: profile
      ? { name: profile.name, bio: profile.bio, phone: profile.phone }
      : undefined,
    // Uploading an avatar rewrites the profile cache, which pushes new
    // `values` in. Without this, that would wipe whatever the user is typing.
    resetOptions: { keepDirtyValues: true },
  });

  async function onSubmit(data: ProfileForm) {
    try {
      await updateProfileMutation.mutateAsync(data);
      router.back();
    } catch (error) {
      setError("root", {
        message:
          error instanceof ApiError && error.status === 401
            ? "Tu sesión expiró. Inicia sesión de nuevo."
            : "No pudimos guardar los cambios. Inténtalo de nuevo.",
      });
    }
  }

  async function onPickAvatar() {
    setAvatarNotice(null);
    const result = await pickAvatarFromLibrary();

    if (result.status === "denied") {
      setAvatarNotice(
        "Necesitamos acceso a tus fotos para cambiar tu avatar.",
      );
      return;
    }
    if (result.status === "canceled") return;

    try {
      await uploadAvatarMutation.mutateAsync(result.image);
    } catch {
      setAvatarNotice("No pudimos subir la imagen. Inténtalo de nuevo.");
    }
  }

  async function onRemoveAvatar() {
    setAvatarNotice(null);
    try {
      await removeAvatarMutation.mutateAsync();
    } catch {
      setAvatarNotice("No pudimos quitar la imagen. Inténtalo de nuevo.");
    }
  }

  if (isPending) {
    return (
      <ThemedView style={styles.centered} testID="edit-profile-loading">
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const isAvatarBusy =
    uploadAvatarMutation.isPending || removeAvatarMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + Spacing.four,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.avatarSection}>
          {isAvatarBusy ? (
            <ThemedView style={styles.avatarBusy} testID="avatar-uploading">
              <ActivityIndicator />
            </ThemedView>
          ) : (
            <Avatar
              uri={profile?.avatarUrl ?? null}
              name={profile?.name ?? ""}
              size={112}
              testID="edit-profile-avatar"
            />
          )}

          <ThemedView style={styles.avatarActions}>
            <Button
              label="Cambiar foto"
              variant="outline"
              size="sm"
              testID="avatar-change-button"
              disabled={isAvatarBusy}
              onPress={onPickAvatar}
            />
            {profile?.avatarUrl ? (
              <Button
                label="Quitar foto"
                variant="ghost"
                size="sm"
                testID="avatar-remove-button"
                disabled={isAvatarBusy}
                onPress={onRemoveAvatar}
              />
            ) : null}
          </ThemedView>

          {avatarNotice ? (
            <ThemedText
              type="small"
              style={styles.errorText}
              testID="avatar-notice"
            >
              {avatarNotice}
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Nombre"
                placeholder="Tu nombre"
                testID="profile-name-input"
                autoCapitalize="words"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="bio"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Sobre mí"
                placeholder="Cuéntanos a qué te dedicas"
                testID="profile-bio-input"
                multiline
                numberOfLines={4}
                maxLength={280}
                style={styles.multiline}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.bio?.message}
                helper={`${value?.length ?? 0}/280`}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Teléfono"
                placeholder="+52 33 1234 5678"
                testID="profile-phone-input"
                keyboardType="phone-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.phone?.message}
              />
            )}
          />

          {errors.root?.message ? (
            <ThemedText
              type="small"
              style={styles.errorText}
              testID="profile-server-error"
            >
              {errors.root.message}
            </ThemedText>
          ) : null}

          <Button
            label="Guardar cambios"
            variant="primary"
            size="lg"
            fullWidth
            testID="profile-submit-button"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />

          <Button
            label="Cancelar"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
            style={styles.selfCentered}
          />
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selfCentered: {
    alignSelf: "center",
  },
  avatarSection: {
    alignItems: "center",
    gap: Spacing.three,
  },
  avatarBusy: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  errorText: {
    // Same error red as the UI kit's TextInput.
    color: "#ef4444",
  },
});
