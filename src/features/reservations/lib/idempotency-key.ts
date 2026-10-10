/**
 * Keys that make `POST /api/reservations` safe to retry.
 *
 * The key must stay **the same across retries of one booking attempt** and
 * differ between attempts. That is the whole contract: generate it once when
 * the user reaches the confirmation step, reuse it for every retry, and throw
 * it away once the booking succeeds.
 */

/**
 * `Math.random` rather than a crypto source on purpose.
 *
 * The key is never a secret and never a capability — the API scopes it to the
 * authenticated customer, so guessing someone else's buys nothing. The only
 * risk is a *self*-collision, where a user's second booking reuses their own
 * earlier key and gets answered with the first reservation. Two 36-bit random
 * segments plus a millisecond timestamp put that far below the odds of the
 * request failing for any other reason, and it needs no native module.
 */
function randomSegment(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createIdempotencyKey(): string {
  return `rsv-${Date.now().toString(36)}-${randomSegment()}-${randomSegment()}`;
}
