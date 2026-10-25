/**
 * Payments domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer.
 * No React, no UI, no Stripe SDK here — the SDK is platform I/O and lives in
 * `lib/`, so this layer stays testable without it.
 */

export type PaymentStatus =
  /** Intent created, nobody has paid yet. */
  | "requires_payment"
  /** Authorized and settling. Common with 3-D Secure. */
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface Payment {
  id: string;
  reservationId: string;
  /** In MXN cents, taken from the reservation — never chosen by the app. */
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  /** Decline reason from Stripe, when there is one. */
  lastError: string | null;
}

/**
 * What the API hands back to start a checkout.
 *
 * `clientSecret` is a credential: it authorizes confirming *this* payment. It
 * is held in memory for the length of the checkout and never persisted.
 */
export interface CheckoutSession {
  clientSecret: string;
  publishableKey: string;
  payment: Payment;
}
