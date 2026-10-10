import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ReservationInput } from "../domain/types";
import {
  cancelReservation,
  confirmReservation,
  createReservation,
} from "../domain/use-cases";
import { reservationsKeys } from "./keys";

/**
 * A booking changes both sides' lists — the customer's and the provider's — and
 * each role/status combination is its own cache entry, so writes invalidate the
 * whole `list` branch rather than patching entries one by one.
 *
 * Fire-and-forget: the promise `invalidateQueries` returns only settles once
 * every matching list has refetched, and returning it from `onSuccess` would
 * keep the mutation `isPending` — and the button spinning — long after the
 * screen has navigated away. Same shape the services mutations use.
 */
function useReservationsInvalidator() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: reservationsKeys.lists() });
    // Booking or cancelling takes or frees an hour, so every availability
    // view is stale the moment either succeeds.
    void queryClient.invalidateQueries({
      queryKey: [...reservationsKeys.all, "availability"],
    });
  };
}

/**
 * Books a slot.
 *
 * The caller owns the idempotency key and must pass the *same* one on a retry;
 * generating it here would defeat the point, since React Query hands each retry
 * a fresh call into this function.
 */
export function useCreateReservationMutation() {
  const invalidateLists = useReservationsInvalidator();

  return useMutation({
    mutationFn: (input: ReservationInput) => createReservation(input),
    onSuccess: invalidateLists,
  });
}

/** The provider accepts a booking. */
export function useConfirmReservationMutation() {
  const invalidateLists = useReservationsInvalidator();

  return useMutation({
    mutationFn: (id: string) => confirmReservation(id),
    onSuccess: invalidateLists,
  });
}

/** Cancels a booking from either side. */
export function useCancelReservationMutation() {
  const invalidateLists = useReservationsInvalidator();

  return useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: invalidateLists,
  });
}
