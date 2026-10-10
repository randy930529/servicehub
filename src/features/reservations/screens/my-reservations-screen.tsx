import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";
import { formatPriceMXN } from "@/shared/lib/format-price";

import type { Reservation, ReservationRole } from "../domain/types";
import { formatSlotFull } from "../lib/booking-slots";
import { useCancelReservationMutation } from "../queries/use-reservation-mutations";
import { useReservationsQuery } from "../queries/use-reservations-query";

const STATUS_LABELS: Record<Reservation["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

const ROLES: { role: ReservationRole; label: string }[] = [
  { role: "customer", label: "Reservé" },
  { role: "provider", label: "Me reservaron" },
];

function errorHint(error: unknown): string {
  if (error instanceof ApiError && error.kind === "network") {
    return "Revisa tu conexión e inténtalo de nuevo.";
  }
  return "Estamos teniendo problemas con el servidor. Inténtalo más tarde.";
}

function ReservationRow({
  reservation,
  now,
}: {
  reservation: Reservation;
  /**
   * Pinned by the screen rather than read here: `Date.now()` during render is
   * impure, and the React Compiler is free to memoize a render — which would
   * freeze "has it happened yet?" at whatever it was the first time.
   */
  now: number;
}) {
  const router = useRouter();
  const { mutate, isPending } = useCancelReservationMutation();
  const cancelled = reservation.status === "cancelled";
  // Only a booking that already happened can be rated — the API enforces it
  // too, but offering the button would just produce a 409.
  const reviewable =
    !cancelled && new Date(reservation.scheduledFor).getTime() < now;

  return (
    <Card testID={`reservation-card-${reservation.id}`}>
      <View style={styles.rowHeader}>
        <ThemedText type="smallBold">{reservation.service.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {STATUS_LABELS[reservation.status]}
        </ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {formatSlotFull(new Date(reservation.scheduledFor))}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {/* The agreed price, not today's — the provider may have repriced. */}
        {formatPriceMXN(reservation.priceAtBookingCents)}
      </ThemedText>

      {reviewable ? (
        <Button
          label="Calificar"
          variant="outline"
          size="sm"
          testID={`reservation-review-${reservation.id}`}
          onPress={() =>
            router.push({
              pathname: "/review",
              params: {
                reservationId: reservation.id,
                serviceName: reservation.service.name,
              },
            })
          }
        />
      ) : null}

      {cancelled || reviewable ? null : (
        <Button
          label="Cancelar"
          variant="destructive"
          size="sm"
          loading={isPending}
          testID={`reservation-cancel-${reservation.id}`}
          onPress={() => mutate(reservation.id)}
        />
      )}
    </Card>
  );
}

/** Both sides of the booking, switched by a segmented control. */
export function MyReservationsScreen() {
  const [role, setRole] = useState<ReservationRole>("customer");
  const [now] = useState(() => Date.now());
  const { data, isPending, isError, error, refetch, isFetching } =
    useReservationsQuery({ role });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Mis reservas
        </ThemedText>

        <View style={styles.roles}>
          {ROLES.map((option) => (
            <Button
              key={option.role}
              label={option.label}
              variant={role === option.role ? "primary" : "outline"}
              size="sm"
              testID={`reservations-role-${option.role}`}
              onPress={() => setRole(option.role)}
            />
          ))}
        </View>

        {isPending ? (
          <View style={styles.centered} testID="reservations-loading">
            <ActivityIndicator size="large" color="#3c87f7" />
          </View>
        ) : isError ? (
          <View style={styles.centered} testID="reservations-error">
            <ThemedText type="smallBold">
              No pudimos cargar tus reservas
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.centeredText}
            >
              {errorHint(error)}
            </ThemedText>
            <Button
              label="Reintentar"
              variant="primary"
              size="md"
              loading={isFetching}
              testID="reservations-retry-button"
              onPress={() => refetch()}
            />
          </View>
        ) : data.length === 0 ? (
          <View style={styles.centered} testID="reservations-empty">
            <ThemedText type="smallBold">
              {role === "customer"
                ? "Todavía no has reservado nada"
                : "Nadie ha reservado tus servicios"}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            testID="reservations-list"
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ReservationRow reservation={item} now={now} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching}
            onRefresh={refetch}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    alignSelf: "center",
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    paddingVertical: Spacing.three,
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roles: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.two,
    justifyContent: "center",
  },
  centeredText: {
    marginBottom: Spacing.two,
    textAlign: "center",
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});
