import { useMutation } from "@tanstack/react-query";

import { startCheckout } from "../domain/use-cases";

/**
 * Asks the API to prepare a payment.
 *
 * No invalidation here: the payment only becomes interesting once the sheet
 * closes, and the checkout screen refetches it then. Invalidating now would
 * fetch a record that is guaranteed to still say `requires_payment`.
 */
export function useStartCheckoutMutation() {
  return useMutation({
    mutationFn: (reservationId: string) => startCheckout(reservationId),
  });
}
