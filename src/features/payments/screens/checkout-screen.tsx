import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";
import { formatPriceMXN } from "@/shared/lib/format-price";

import type { PaymentStatus } from "../domain/types";
import { runCheckout } from "../lib/stripe-checkout";
import { usePaymentQuery } from "../queries/use-payment-query";
import { useStartCheckoutMutation } from "../queries/use-start-checkout-mutation";

/** What the screen is doing, as opposed to what the payment says. */
type ScreenPhase = "idle" | "opening" | "settling" | "canceled" | "error";

const STATUS_COPY: Record<PaymentStatus, { title: string; hint: string }> = {
  requires_payment: {
    title: "Pendiente de pago",
    hint: "Aún no se ha cobrado nada.",
  },
  processing: {
    title: "Procesando el pago",
    hint: "Tu banco está confirmando el cargo. Esto puede tardar unos segundos.",
  },
  succeeded: {
    title: "Pago completado",
    hint: "Ya está. El proveedor verá tu reserva como pagada.",
  },
  failed: {
    title: "El pago no se completó",
    hint: "No se te cobró nada. Puedes intentarlo con otra tarjeta.",
  },
  canceled: {
    title: "Pago cancelado",
    hint: "Este cobro ya no se puede completar.",
  },
};

function errorHint(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return "Revisa tu conexión e inténtalo de nuevo.";
    }
    if (error.status === 503) {
      return "Los pagos no están disponibles ahora mismo.";
    }
    if ((error.status === 409 || error.status === 404) && error.message) {
      return error.message;
    }
  }
  return "No pudimos iniciar el pago. Inténtalo más tarde.";
}

export type CheckoutScreenProps = {
  reservationId: string;
  serviceName: string;
  amountCents: number;
};

/**
 * Pay for a reservation.
 *
 * The screen deliberately separates two things that look alike:
 *
 *  - **The sheet closed successfully** — Stripe accepted the card.
 *  - **The payment settled** — our webhook heard back from Stripe.
 *
 * Only the second one means paid, so after the sheet closes the screen waits
 * on our own API rather than celebrating on the SDK's word.
 */
export function CheckoutScreen({
  reservationId,
  serviceName,
  amountCents,
}: CheckoutScreenProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ScreenPhase>("idle");
  const [sheetError, setSheetError] = useState<string | null>(null);

  const startCheckout = useStartCheckoutMutation();
  const { data: payment, refetch } = usePaymentQuery(reservationId, {
    poll: phase === "settling",
  });

  const settled = payment?.status === "succeeded" || payment?.status === "canceled";
  const busy = phase === "opening" || startCheckout.isPending;

  async function pay() {
    setPhase("opening");
    setSheetError(null);

    try {
      const session = await startCheckout.mutateAsync(reservationId);
      const outcome = await runCheckout({
        clientSecret: session.clientSecret,
        publishableKey: session.publishableKey,
      });

      if (outcome.status === "canceled") {
        setPhase("canceled");
        return;
      }

      if (outcome.status === "failed") {
        setSheetError(outcome.message);
        setPhase("error");
        return;
      }

      // Card accepted. Now wait for the webhook to say the money moved.
      setPhase("settling");
      void refetch();
    } catch (error) {
      setSheetError(errorHint(error));
      setPhase("error");
    }
  }

  const status = payment?.status;
  const copy = status ? STATUS_COPY[status] : null;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Pagar
        </ThemedText>

        <Card testID="checkout-summary">
          <ThemedText type="smallBold">{serviceName}</ThemedText>
          <ThemedText type="title" style={styles.amount}>
            {formatPriceMXN(amountCents)}
          </ThemedText>
        </Card>

        {copy ? (
          <Card testID={`checkout-status-${status}`}>
            <View style={styles.statusRow}>
              {status === "processing" ? <ActivityIndicator /> : null}
              <ThemedText type="smallBold">{copy.title}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {/* Stripe's decline reason beats anything we could invent. */}
              {payment?.lastError ?? copy.hint}
            </ThemedText>
          </Card>
        ) : null}

        {phase === "canceled" ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="checkout-canceled"
          >
            Cancelaste el pago. No se te cobró nada.
          </ThemedText>
        ) : null}

        {phase === "error" ? (
          <ThemedText type="small" style={styles.error} testID="checkout-error">
            {sheetError ?? errorHint(startCheckout.error)}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {payment?.status === "succeeded" ? (
          <Button
            label="Volver a mis reservas"
            variant="primary"
            size="lg"
            fullWidth
            testID="checkout-done-button"
            onPress={() => router.replace("/my-reservations")}
          />
        ) : (
          <Button
            label={phase === "settling" ? "Confirmando…" : "Pagar ahora"}
            variant="primary"
            size="lg"
            fullWidth
            loading={busy || phase === "settling"}
            // `canceled` is terminal server-side: this intent is dead and
            // retrying it would only produce another error.
            disabled={settled}
            testID="checkout-pay-button"
            onPress={pay}
          />
        )}
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
    flex: 1,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  amount: {
    fontSize: 32,
    fontWeight: "700",
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
  error: {
    color: "#d93025",
  },
  actions: {
    alignSelf: "center",
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.two,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
});
