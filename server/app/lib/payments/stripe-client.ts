import Stripe from "stripe";

/**
 * The Stripe client, plus the environment it needs.
 *
 * Built lazily rather than at module load: importing this file must not throw
 * in an environment that has no Stripe keys — the rest of the API works fine
 * without payments, and a missing key should fail the payment endpoints, not
 * the whole server.
 */

let client: Stripe | null = null;

export function getStripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY || null;
}

/** Given to the app so the mobile SDK can talk to Stripe directly. */
export function getStripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

/**
 * The secret Stripe signs webhooks with. Without it, signature verification
 * is impossible and the endpoint must refuse everything — an unverified
 * webhook is just a stranger claiming someone paid.
 */
export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

/** Currency every charge uses. The catalog prices in MXN cents. */
export const PAYMENT_CURRENCY = "mxn";

export function getStripe(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;

  // One client per process; the SDK keeps its own connection pool.
  client ??= new Stripe(key);
  return client;
}
