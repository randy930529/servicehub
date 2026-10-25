import { useQuery } from "@tanstack/react-query";

import { getPayment } from "../domain/use-cases";
import { paymentsKeys } from "./keys";

/** How long to keep asking while a charge is still settling. */
const SETTLING_POLL_MS = 2000;

/**
 * The caller's payment for a reservation.
 *
 * Polls while the payment is unsettled, because the thing that confirms it is
 * a **webhook**, not the app: Stripe calls our server, and the app only finds
 * out by asking again. Polling stops the moment the payment reaches a final
 * state, so an idle screen makes no requests.
 */
export function usePaymentQuery(
  reservationId: string | undefined,
  { poll = false }: { poll?: boolean } = {},
) {
  return useQuery({
    queryKey: paymentsKeys.byReservation(reservationId ?? ""),
    queryFn: () => getPayment(reservationId as string),
    enabled: Boolean(reservationId),
    // Never cached: a payment's whole point is that it changes underneath us.
    staleTime: 0,
    refetchInterval: (query) => {
      if (!poll) return false;

      const status = query.state.data?.status;
      const settled = status === "succeeded" || status === "canceled";

      return settled ? false : SETTLING_POLL_MS;
    },
  });
}
