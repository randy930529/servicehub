/**
 * Refund arithmetic and reconciliation, as pure functions.
 *
 * Money that moves backwards is the part nobody tests until it goes wrong, so
 * the rules live here where every boundary can be enumerated without a Stripe
 * account or a database.
 */

/**
 * Refund state is **not** a payment status.
 *
 * `succeeded` is deliberately terminal in `shouldApplyStatus` — that is what
 * stops a late `payment_failed` from un-paying an order. Folding `refunded`
 * into the same enum would mean either breaking that guarantee or forbidding
 * refunds; keeping the two orthogonal avoids the choice. A charge that
 * succeeded and was then refunded is both of those things, and saying so is
 * more honest than overwriting one with the other.
 */
export type RefundStateType = "none" | "partial" | "full";

export function refundState(
  amountCents: number,
  refundedCents: number,
): RefundStateType {
  if (refundedCents <= 0) return "none";
  // `>=` rather than `===`: Stripe fees and currency rounding can, in odd
  // cases, settle a cent above. Treating that as "partial" would leave a
  // payment looking permanently half-refunded.
  if (refundedCents >= amountCents) return "full";
  return "partial";
}

export type RefundCheckType =
  | { ok: true; amountCents: number }
  | { ok: false; message: string };

/**
 * Validates a refund request against what is actually left.
 *
 * `requested` omitted means "the rest", which is what an operator almost
 * always wants and is safer than making them compute it under pressure.
 */
export function checkRefundable(
  payment: { amountCents: number; refundedCents: number; status: string },
  requested?: number,
): RefundCheckType {
  if (payment.status !== "succeeded") {
    return {
      ok: false,
      message: "Only a succeeded payment can be refunded",
    };
  }

  const remaining = payment.amountCents - payment.refundedCents;

  if (remaining <= 0) {
    return { ok: false, message: "This payment is already fully refunded" };
  }

  if (requested === undefined) return { ok: true, amountCents: remaining };

  if (!Number.isInteger(requested) || requested <= 0) {
    return { ok: false, message: "Refund amount must be a positive integer" };
  }

  if (requested > remaining) {
    return {
      ok: false,
      message: `Cannot refund more than the remaining ${remaining} cents`,
    };
  }

  return { ok: true, amountCents: requested };
}

/** Refund events worth acting on. */
export const REFUND_EVENTS = [
  "charge.refunded",
  "refund.updated",
  "refund.failed",
] as const;

export type DiscrepancyKindType =
  | "status_drift"
  | "amount_drift"
  | "refund_drift"
  | "missing_in_stripe";

export type DiscrepancyType = {
  paymentId: string;
  kind: DiscrepancyKindType;
  ours: string;
  theirs: string;
};

export type ReconcileInputType = {
  paymentId: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  /** `null` when Stripe has no intent with that id — the worst case. */
  stripe: {
    status: string;
    amountCents: number;
    refundedCents: number;
  } | null;
};

/**
 * Compares our record of a payment against Stripe's.
 *
 * Stripe is the source of truth for money; this never "fixes" anything, it
 * only reports. An automatic repair that is wrong moves real money, while a
 * report that is wrong costs somebody five minutes.
 */
export function reconcilePayment(
  input: ReconcileInputType,
  mapStatus: (stripeStatus: string) => string,
): DiscrepancyType[] {
  const { paymentId, stripe } = input;

  if (!stripe) {
    return [
      {
        paymentId,
        kind: "missing_in_stripe",
        ours: input.status,
        theirs: "not found",
      },
    ];
  }

  const found: DiscrepancyType[] = [];
  const theirStatus = mapStatus(stripe.status);

  if (theirStatus !== input.status) {
    found.push({
      paymentId,
      kind: "status_drift",
      ours: input.status,
      theirs: theirStatus,
    });
  }

  if (stripe.amountCents !== input.amountCents) {
    found.push({
      paymentId,
      kind: "amount_drift",
      ours: String(input.amountCents),
      theirs: String(stripe.amountCents),
    });
  }

  if (stripe.refundedCents !== input.refundedCents) {
    found.push({
      paymentId,
      kind: "refund_drift",
      ours: String(input.refundedCents),
      theirs: String(stripe.refundedCents),
    });
  }

  return found;
}
