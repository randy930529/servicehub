import type { Reservation, ReservationFilters } from "../types";

/** A reservation as returned by the backend (Mongo `_id`). */
export interface ApiReservation {
  _id: string;
  service: { id: string; name: string; imageUrl?: string | null };
  customerId: string;
  providerId: string;
  scheduledFor: string;
  status: Reservation["status"];
  priceAtBookingCents: number;
  cancelledAt?: string | null;
}

export interface ApiReservationList {
  data: ApiReservation[];
}

export interface ApiReservationResponse {
  reservation: ApiReservation;
}

/** Maps the API shape (`_id`) to the domain `Reservation` (`id`). */
export function toReservation(api: ApiReservation): Reservation {
  return {
    id: api._id,
    service: {
      id: api.service.id,
      name: api.service.name,
      imageUrl: api.service.imageUrl ?? null,
    },
    customerId: api.customerId,
    providerId: api.providerId,
    scheduledFor: api.scheduledFor,
    status: api.status,
    priceAtBookingCents: api.priceAtBookingCents,
    cancelledAt: api.cancelledAt ?? null,
  };
}

/**
 * Turns domain filters into query params. Empty values are omitted rather than
 * sent blank, so the request URL — and therefore the React Query cache key —
 * stays stable when a filter is off.
 */
export function toReservationQueryParams(
  filters: ReservationFilters = {},
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.role) params.role = filters.role;
  if (filters.status) params.status = filters.status;
  return params;
}
