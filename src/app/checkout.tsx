import { useLocalSearchParams } from "expo-router";

import { CheckoutScreen } from "@/features/payments";

/**
 * The amount travels as a param rather than being refetched: it comes from
 * the reservation the user is looking at, and the server recomputes it from
 * the booking anyway — this value is only what the screen *displays*, never
 * what gets charged.
 */
export default function CheckoutRoute() {
  const { reservationId, serviceName, amountCents } = useLocalSearchParams<{
    reservationId: string;
    serviceName?: string;
    amountCents?: string;
  }>();

  return (
    <CheckoutScreen
      reservationId={reservationId}
      serviceName={serviceName ?? "este servicio"}
      amountCents={Number(amountCents) || 0}
    />
  );
}
