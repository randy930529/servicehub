import type { CheckoutSession, Payment } from "../types";

/** A payment as returned by the backend (Mongo `_id`). */
export interface ApiPayment {
  _id: string;
  reservationId: string;
  amountCents: number;
  currency: string;
  status: Payment["status"];
  lastError?: string | null;
  refundedCents?: number;
  refundState?: Payment["refundState"];
  createdAt?: string | null;
}

export interface ApiCheckoutResponse {
  clientSecret: string;
  publishableKey: string;
  payment: ApiPayment;
}

export interface ApiPaymentResponse {
  payment: ApiPayment | null;
}

export interface ApiPaymentList {
  data: ApiPayment[];
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
    // Payments made before refunds existed have neither field.
    refundedCents: api.refundedCents ?? 0,
    refundState: api.refundState ?? "none",
    createdAt: api.createdAt ?? null,
  };
}

export function toCheckoutSession(api: ApiCheckoutResponse): CheckoutSession {
  return {
    clientSecret: api.clientSecret,
    publishableKey: api.publishableKey,
    payment: toPayment(api.payment),
  };
}
