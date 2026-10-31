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

import type {
  CancelPaymentOutcome,
  Reservation,
  ReservationRole,
} from "../domain/types";
import { formatSlotFull } from "../lib/booking-slots";
import {
  useCancelReservationMutation,
  useConfirmReservationMutation,
} from "../queries/use-reservation-mutations";
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
  role,
}: {
  reservation: Reservation;
  /** Which side is looking: only a provider sees "Confirmar". */
  role: ReservationRole;
  /**
   * Pinned by the screen rather than read here: `Date.now()` during render is
   * impure, and the React Compiler is free to memoize a render — which would
   * freeze "has it happened yet?" at whatever it was the first time.
   */
  now: number;
}) {
  const router = useRouter();
  const cancel = useCancelReservationMutation();
  const confirm = useConfirmReservationMutation();
  const cancelled = reservation.status === "cancelled";
  // Confirming a slot that already passed does nothing, and the API rejects
  // it, so the button only shows where it would actually work.
  // Paying is the customer's side, and only for a booking that still lies
  // ahead: charging for something already past belongs to a refund flow.
  const payable =
    role === "customer" &&
    !cancelled &&
    new Date(reservation.scheduledFor).getTime() > now;
  const confirmable =
    role === "provider" &&
    reservation.status === "pending" &&
    new Date(reservation.scheduledFor).getTime() > now;
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

      {confirmable ? (
        <Button
          label="Confirmar"
          variant="primary"
          size="sm"
          loading={confirm.isPending}
          testID={`reservation-confirm-${reservation.id}`}
          onPress={() => confirm.mutate(reservation.id)}
        />
      ) : null}

      {payable ? (
        <Button
          label="Pagar"
          variant="primary"
          size="sm"
          testID={`reservation-pay-${reservation.id}`}
          onPress={() =>
            router.push({
              pathname: "/checkout",
              params: {
                reservationId: reservation.id,
                serviceName: reservation.service.name,
                amountCents: String(reservation.priceAtBookingCents),
              },
            })
          }
        />
      ) : null}

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

      <Button
        label="Mensaje"
        variant="ghost"
        size="sm"
        testID={`reservation-chat-${reservation.id}`}
        onPress={() =>
          // Navigation by path, not an import: features may not depend on
          // each other, and the chat route only needs who to write to. It
          // opens the thread itself if there is not one yet.
          router.push({
            pathname: "/chat",
            params: {
              peerId:
                role === "customer"
                  ? reservation.providerId
                  : reservation.customerId,
            },
          })
        }
      />

      {cancelled || reviewable ? null : (
        <Button
          label="Cancelar"
          variant="destructive"
          size="sm"
          loading={cancel.isPending}
          testID={`reservation-cancel-${reservation.id}`}
          onPress={() => cancel.mutate(reservation.id)}
        />
      )}

      {/* What happened to the money, said out loud. A refund the customer
          is never told about reads exactly like no refund at all. */}
      {cancel.data ? (
        <RefundNotice
          outcome={cancel.data.payment}
          testID={`reservation-refund-${reservation.id}`}
        />
      ) : null}
    </Card>
  );
}

function RefundNotice({
  outcome,
  testID,
}: {
  outcome: CancelPaymentOutcome;
  testID: string;
}) {
  if (outcome.action === "none") return null;

  if (outcome.action === "refunded") {
    return (
      <ThemedText type="small" themeColor="textSecondary" testID={testID}>
        Te devolvemos {formatPriceMXN(outcome.amountCents)}. Tu banco puede
        tardar unos días en mostrarlo.
      </ThemedText>
    );
  }

  if (outcome.action === "canceled_intent") {
    return (
      <ThemedText type="small" themeColor="textSecondary" testID={testID}>
        No se te cobró nada.
      </ThemedText>
    );
  }

  // `manual`: the booking is cancelled either way, and saying "revisamos" is
  // more honest than a cheerful message about money that has not moved.
  return (
    <ThemedText type="small" style={styles.warning} testID={testID}>
      Cancelamos la reserva, pero el reembolso quedó pendiente de revisión.
    </ThemedText>
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
        ) : (
          <FlatList
            testID="reservations-list"
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ReservationRow reservation={item} now={now} role={role} />
            )}
            // Inside the list, not instead of it: rendered as a sibling the
            // empty state looks identical and leaves no way to refresh — and
            // the provider side fills up without this screen being touched.
            ListEmptyComponent={
              <View style={styles.centered} testID="reservations-empty">
                <ThemedText type="smallBold">
                  {role === "customer"
                    ? "Todavía no has reservado nada"
                    : "Nadie ha reservado tus servicios"}
                </ThemedText>
              </View>
            }
            contentContainerStyle={[
              styles.listContent,
              // An empty list is zero-height, and a pull on empty space is
              // not a pull on the list.
              data.length === 0 && styles.listContentEmpty,
            ]}
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
  warning: {
    color: "#b45309",
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
