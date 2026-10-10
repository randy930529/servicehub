import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet } from "react-native";

import { BookingScreen } from "@/features/reservations";
import { useServiceQuery } from "@/features/services";
import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Spacing } from "@/shared/constants/theme";

/**
 * Bridges the services feature to the reservations one.
 *
 * Thicker than the other routes on purpose: features may not import each
 * other, so the app layer is the only place allowed to know that a booking
 * starts from a service. `BookingScreen` just takes the slice it needs —
 * same shape as the root layout wiring auth state into push registration.
 */
export default function BookingRoute() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const { data: service, isPending, isError } = useServiceQuery(serviceId);

  if (isPending) {
    return (
      <ThemedView style={styles.centered} testID="booking-loading">
        <ActivityIndicator size="large" color="#3c87f7" />
      </ThemedView>
    );
  }

  if (isError || !service) {
    return (
      <ThemedView style={styles.centered} testID="booking-not-found">
        <ThemedText type="smallBold">No encontramos ese servicio</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Puede que ya no esté disponible.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <BookingScreen
      service={{
        id: service.id,
        name: service.name,
        priceFromCents: service.priceFromCents,
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.one,
    justifyContent: "center",
    padding: Spacing.four,
  },
  hint: {
    textAlign: "center",
  },
});
