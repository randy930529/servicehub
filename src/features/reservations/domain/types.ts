/**
 * Reservations domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer.
 * No React, no UI, no persistence concerns here.
 */

export type ReservationStatus = "pending" | "confirmed" | "cancelled";

/** The booked service, flattened to what a reservation row needs to render. */
export interface ReservationService {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface Reservation {
  id: string;
  service: ReservationService;
  customerId: string;
  providerId: string;
  /** ISO 8601, UTC. Parse with `new Date()` at the edge that renders it. */
  scheduledFor: string;
  status: ReservationStatus;
  /**
   * What the service cost when it was booked, in MXN cents. A snapshot, not
   * today's price: the provider may have repriced since.
   */
  priceAtBookingCents: number;
  cancelledAt: string | null;
}

/**
 * What happened to the money when a booking was cancelled.
 *
 * Cancelling is not only about the slot: a charge that went through gets
 * refunded and an unpaid intent gets killed, and the person who cancelled
 * deserves to be told which.
 */
export type CancelPaymentOutcome =
  /** There was no payment, or nothing left to undo. */
  | { action: "none" }
  | { action: "refunded"; amountCents: number }
  /** Nobody had paid; the intent was cancelled so nobody can. */
  | { action: "canceled_intent" }
  /** The server could not finish it. Somebody has to look. */
  | { action: "manual"; reason: string };

export interface CancelResult {
  reservation: Reservation;
  payment: CancelPaymentOutcome;
}

/** What the app sends to book a slot. */
export interface ReservationInput {
  serviceId: string;
  /** ISO 8601 with offset, so the API never has to guess a timezone. */
  scheduledFor: string;
  /**
   * Stable across retries of one booking attempt. Without it the API refuses
   * the request — a retry would be indistinguishable from a second booking.
   */
  idempotencyKey: string;
}

/** Which side of the booking a list is asking about. */
export type ReservationRole = "customer" | "provider";

export interface ReservationFilters {
  role?: ReservationRole;
  status?: ReservationStatus;
}

/**
 * The slice of a service this feature needs to book it.
 *
 * Declared here rather than imported from `features/services`: features may
 * not depend on each other, so the app layer is what maps one onto the other.
 */
export interface BookableService {
  id: string;
  name: string;
  priceFromCents: number;
}
