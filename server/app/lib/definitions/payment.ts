import type { PaymentStatusType } from "@/app/lib/helpers/payment-status";

/**
 * A payment as sent to clients.
 *
 * No Stripe ids and no `client_secret` here: the secret is handed to the app
 * once, in the checkout response, and never again. Echoing it into every
 * payment listing would spread a credential that can confirm a charge.
 */
export type PublicPaymentType = {
  _id: string;
  reservationId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatusType;
  /** Decline reason from Stripe, when there is one. Not sensitive. */
  lastError: string | null;
  createdAt: string | null;
};
