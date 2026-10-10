import type { ReservationStatus } from "@/app/lib/models";

/** The booked service, flattened to what a reservation list needs to render. */
export type ReservationServiceType = {
  id: string;
  name: string;
  imageUrl: string | null;
};

/**
 * A reservation as sent to clients.
 *
 * `idempotencyKey` never crosses this boundary: it is a transport detail
 * between one client and the API, and echoing it back would invite callers to
 * treat someone else's key as an identifier.
 */
export type PublicReservationType = {
  _id: string;
  service: ReservationServiceType;
  customerId: string;
  providerId: string;
  /** ISO 8601, UTC. */
  scheduledFor: string;
  status: ReservationStatus;
  /** What it cost when booked, in MXN cents — not today's price. */
  priceAtBookingCents: number;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
