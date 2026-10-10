import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";
import { formatPriceMXN } from "@/shared/lib/format-price";

import { SlotPicker } from "../components/slot-picker";
import type { BookableService } from "../domain/types";
import { formatSlotFull } from "../lib/booking-slots";
import { createIdempotencyKey } from "../lib/idempotency-key";
import { useCreateReservationMutation } from "../queries/use-reservation-mutations";

type BookingStep = "slot" | "confirm";

function errorHint(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return "Revisa tu conexión e inténtalo de nuevo.";
    }
    // 409s carry a real explanation (own service, key reused, no provider);
    // showing it beats a generic message the user can do nothing with.
    if (error.status === 409 && error.message) return error.message;
  }
  return "No pudimos crear la reserva. Inténtalo más tarde.";
}

export type BookingScreenProps = {
  service: BookableService;
  /**
   * The service's reviews, injected by the app layer. A node rather than a
   * service id because reviews live in their own feature and features may not
   * import each other — the route is the only place allowed to know both.
   */
  reviews?: React.ReactNode;
};

/**
 * Two-step booking: pick a slot, then confirm.
 *
 * Deliberately not a wizard abstraction — there are two steps and there will
 * not be twenty. A local union beats a framework here.
 */
export function BookingScreen({ service, reviews }: BookingScreenProps) {
  const router = useRouter();

  const [step, setStep] = useState<BookingStep>("slot");
  const [slot, setSlot] = useState<Date | null>(null);
  /**
   * Generated once, when the user reaches the confirmation step, and reused by
   * every retry of that attempt. Regenerating it per request would make each
   * retry look like a fresh booking to the API, which is the exact duplicate
   * the key exists to prevent.
   */
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const { mutate, isPending, isError, error } = useCreateReservationMutation();

  function goToConfirm() {
    if (!slot) return;
    setIdempotencyKey(createIdempotencyKey());
    setStep("confirm");
  }

  function book() {
    if (!slot || !idempotencyKey) return;

    mutate(
      {
        serviceId: service.id,
        // Includes the device's offset, so the API never has to guess.
        scheduledFor: slot.toISOString(),
        idempotencyKey,
      },
      { onSuccess: () => router.replace("/my-reservations") },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {step === "slot" ? "Elige un horario" : "Confirma tu reserva"}
        </ThemedText>

        <Card testID="booking-service-card">
          <ThemedText type="smallBold">{service.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Desde {formatPriceMXN(service.priceFromCents)}
          </ThemedText>
        </Card>

        {step === "slot" ? (
          <>
            <SlotPicker
              serviceId={service.id}
              selected={slot}
              onSelect={setSlot}
            />
            {reviews}
          </>
        ) : (
          <Card testID="booking-summary">
            <ThemedText type="small" themeColor="textSecondary">
              Horario
            </ThemedText>
            <ThemedText type="smallBold" style={styles.summaryValue}>
              {slot ? formatSlotFull(slot) : ""}
            </ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              Precio
            </ThemedText>
            <ThemedText type="smallBold">
              {formatPriceMXN(service.priceFromCents)}
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.disclaimer}
            >
              El proveedor confirmará tu reserva. Puedes cancelarla en
              cualquier momento desde Mis reservas.
            </ThemedText>
          </Card>
        )}

        {isError ? (
          <ThemedText type="small" style={styles.error} testID="booking-error">
            {errorHint(error)}
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {step === "confirm" ? (
          <Button
            label="Volver"
            variant="ghost"
            size="lg"
            testID="booking-back-button"
            // The key is dropped on the way back: changing the slot makes this
            // a different booking, and reusing the key would have the API
            // answer with the previous one.
            onPress={() => {
              setIdempotencyKey(null);
              setStep("slot");
            }}
          />
        ) : null}

        <Button
          label={step === "slot" ? "Continuar" : "Reservar"}
          variant="primary"
          size="lg"
          fullWidth
          disabled={!slot}
          loading={isPending}
          testID={step === "slot" ? "booking-continue-button" : "booking-confirm-button"}
          onPress={step === "slot" ? goToConfirm : book}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingBottom: Spacing.four,
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  summaryValue: {
    marginBottom: Spacing.two,
  },
  disclaimer: {
    marginTop: Spacing.three,
  },
  error: {
    color: "#d93025",
  },
  actions: {
    alignSelf: "center",
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.two,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
});
