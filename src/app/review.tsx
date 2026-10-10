import { useLocalSearchParams } from "expo-router";

import { ReviewFormScreen } from "@/features/reviews";

/**
 * The reservation being rated travels as a param rather than being looked up:
 * the only thing the form needs is its id, and the name is already on screen
 * wherever the user tapped "Calificar".
 */
export default function ReviewRoute() {
  const { reservationId, serviceName } = useLocalSearchParams<{
    reservationId: string;
    serviceName?: string;
  }>();

  return (
    <ReviewFormScreen
      reservationId={reservationId}
      serviceName={serviceName ?? "este servicio"}
    />
  );
}
