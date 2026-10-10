import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { BottomTabInset, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";

import { Avatar } from "../components/avatar";
import { useProfileQuery } from "../queries/use-profile-query";

export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: profile, isPending, isError, error, refetch } = useProfileQuery();

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top + Spacing.four,
      paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
    },
  ];

  if (isPending) {
    return (
      <ThemedView style={styles.centered} testID="profile-loading">
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (isError) {
    // A 401 here means the session is gone for good: the shared client already
    // tried to refresh it once before the error surfaced.
    const isUnauthenticated = error instanceof ApiError && error.status === 401;

    return (
      <ThemedView style={[styles.centered, styles.gap]} testID="profile-error">
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {isUnauthenticated
            ? "Tu sesión expiró. Inicia sesión de nuevo."
            : "No pudimos cargar tu perfil."}
        </ThemedText>
        <Button
          label={isUnauthenticated ? "Ir a iniciar sesión" : "Reintentar"}
          variant="primary"
          size="md"
          testID="profile-error-action"
          onPress={() =>
            isUnauthenticated ? router.replace("/(auth)/login") : refetch()
          }
        />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={containerStyle}>
      <ThemedView style={styles.header}>
        <Avatar
          uri={profile.avatarUrl}
          name={profile.name}
          size={112}
          testID="profile-avatar"
        />
        <ThemedText type="subtitle" testID="profile-name">
          {profile.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {profile.email}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="smallBold">Sobre mí</ThemedText>
        <ThemedText themeColor={profile.bio ? "text" : "textSecondary"}>
          {profile.bio || "Aún no has escrito una descripción."}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="smallBold">Teléfono</ThemedText>
        <ThemedText themeColor={profile.phone ? "text" : "textSecondary"}>
          {profile.phone || "Sin teléfono"}
        </ThemedText>
      </ThemedView>

      <Button
        label="Editar perfil"
        variant="primary"
        size="lg"
        fullWidth
        testID="profile-edit-button"
        onPress={() => router.push("/edit-profile")}
      />

      <Button
        label="Mis servicios"
        variant="outline"
        size="lg"
        fullWidth
        testID="profile-my-services-button"
        onPress={() => router.push("/my-services")}
      />

      <Button
        label="Mis reservas"
        variant="outline"
        size="lg"
        fullWidth
        testID="profile-reservations-button"
        onPress={() => router.push("/my-reservations")}
      />

      <Button
        label="Notificaciones"
        variant="outline"
        size="lg"
        fullWidth
        testID="profile-notifications-button"
        onPress={() => router.push("/notifications")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  centeredText: {
    textAlign: "center",
  },
  gap: {
    gap: Spacing.three,
  },
  header: {
    alignItems: "center",
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.one,
  },
});
