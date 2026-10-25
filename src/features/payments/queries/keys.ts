/**
 * Query key factory for the payments feature. Centralizing keys keeps cache
 * reads and invalidations consistent and typo-free.
 */
export const paymentsKeys = {
  all: ["payments"] as const,
  byReservation: (reservationId: string) =>
    [...paymentsKeys.all, reservationId] as const,
};
