import type { CheckoutSession, Payment } from "../types";

/** A payment as returned by the backend (Mongo `_id`). */
export interface ApiPayment {
  _id: string;
  reservationId: string;
  amountCents: number;
  currency: string;
  status: Payment["status"];
  lastError?: string | null;
}

export interface ApiCheckoutResponse {
  clientSecret: string;
  publishableKey: string;
  payment: ApiPayment;
}

export interface ApiPaymentResponse {
  payment: ApiPayment | null;
}

/** Maps the API shape (`_id`) to the domain `Payment` (`id`). */
export function toPayment(api: ApiPayment): Payment {
  return {
    id: api._id,
    reservationId: api.reservationId,
    amountCents: api.amountCents,
    currency: api.currency,
    status: api.status,
    lastError: api.lastError ?? null,
  };
}

export function toCheckoutSession(api: ApiCheckoutResponse): CheckoutSession {
  return {
    clientSecret: api.clientSecret,
    publishableKey: api.publishableKey,
    payment: toPayment(api.payment),
  };
}
