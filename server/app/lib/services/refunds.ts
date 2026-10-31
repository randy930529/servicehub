import { isValidObjectId } from "mongoose";
import type Stripe from "stripe";

import {
  checkRefundable,
  mapStripeStatus,
  reconcilePayment,
  refundState,
  type DiscrepancyType,
} from "@/app/lib/helpers";
import { Payment } from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getStripe } from "@/app/lib/payments/stripe-client";

export type RefundResultType =
  | {
      ok: true;
      refundId: string;
      amountCents: number;
      refundedCents: number;
      state: string;
    }
  | { ok: false; status: number; message: string };

/**
 * `POST /api/payments/:id/refund` — gives money back.
 *
 * Admin only, and deliberately so: this is the one endpoint in the system
 * that moves money in the direction nobody can undo by retrying.
 *
 * Idempotent through Stripe: the key is derived from the payment and the
 * amount already refunded, so a double-click replays the same refund instead
 * of issuing a second one. That matters more here than anywhere else — a
 * duplicated charge can be refunded, a duplicated refund has to be chased.
 */
export async function refundPayment(
  paymentId: string,
  requestedCents?: number,
): Promise<RefundResultType> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: 503, message: "Payments are not configured" };
  }

  if (!isValidObjectId(paymentId)) {
    return { ok: false, status: 404, message: "Payment not found" };
  }

  await connectToDatabase();

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return { ok: false, status: 404, message: "Payment not found" };
  }

  const check = checkRefundable(
    {
      amountCents: payment.amountCents,
      refundedCents: payment.refundedCents,
      status: payment.status,
    },
    requestedCents,
  );

  if (!check.ok) {
    return { ok: false, status: 409, message: check.message };
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId,
      amount: check.amountCents,
    },
    {
      // Includes the already-refunded total, so two *different* partial
      // refunds get different keys while a retry of the same one does not.
      idempotencyKey: `refund:${paymentId}:${payment.refundedCents}:${check.amountCents}`,
    },
  );

  // The webhook will also apply this. Writing it here too is deliberate: the
  // operator who clicked refund should see the result immediately, and the
  // event-id dedupe makes the second application a no-op.
  await applyRefundToPayment(payment.stripePaymentIntentId, refund);

  const updated = await Payment.findById(paymentId);
  const refundedCents = updated?.refundedCents ?? check.amountCents;

  return {
    ok: true,
    refundId: refund.id,
    amountCents: check.amountCents,
    refundedCents,
    state: refundState(payment.amountCents, refundedCents),
  };
}

/**
 * Records a Stripe refund against the payment it belongs to.
 *
 * Keyed on the refund id so applying the same refund twice — once from the
 * endpoint, once from the webhook — adds it once.
 */
export async function applyRefundToPayment(
  paymentIntentId: string,
  refund: Stripe.Refund,
): Promise<boolean> {
  await connectToDatabase();

  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntentId,
  });

  if (!payment) return false;

  const existing = payment.refunds.find(
    (r) => r.stripeRefundId === refund.id,
  );

  if (existing) {
    // Status can legitimately change (`pending` → `succeeded`), the amount
    // cannot.
    if (existing.status === refund.status) return false;
    existing.status = refund.status ?? "unknown";
  } else {
    payment.refunds.push({
      stripeRefundId: refund.id,
      amountCents: refund.amount,
      status: refund.status ?? "unknown",
      reason: refund.reason ?? null,
    });
  }

  // Recomputed from the list rather than incremented: a counter that drifts
  // from its own history is worse than no counter. Only refunds that actually
  // landed count — a failed one gave nothing back.
  payment.refundedCents = payment.refunds
    .filter((r) => r.status === "succeeded" || r.status === "pending")
    .reduce((sum, r) => sum + r.amountCents, 0);

  await payment.save();
  return true;
}

export type ReconcileReportType = {
  checked: number;
  discrepancies: DiscrepancyType[];
};

/**
 * `GET /api/payments/reconcile` — compares our records against Stripe.
 *
 * Reports, never repairs. Stripe owns the money; an automatic "fix" that is
 * wrong moves real funds, while a report that is wrong costs somebody five
 * minutes. The runbook turns these findings into actions by hand.
 */
export async function reconcilePayments(
  limit = 50,
): Promise<ReconcileReportType | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  await connectToDatabase();

  const payments = await Payment.find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(1, limit), 200));

  const discrepancies: DiscrepancyType[] = [];

  for (const payment of payments) {
    let intent: Stripe.PaymentIntent | null = null;

    try {
      intent = await stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
        { expand: ["latest_charge"] },
      );
    } catch {
      // A retrieve that fails is itself the finding: the intent we recorded
      // is not one Stripe will admit to.
      intent = null;
    }

    const charge = intent?.latest_charge as Stripe.Charge | null | undefined;

    discrepancies.push(
      ...reconcilePayment(
        {
          paymentId: String(payment._id),
          status: payment.status,
          amountCents: payment.amountCents,
          refundedCents: payment.refundedCents,
          stripe: intent
            ? {
                status: intent.status,
                amountCents: intent.amount,
                refundedCents: charge?.amount_refunded ?? 0,
              }
            : null,
        },
        mapStripeStatus,
      ),
    );
  }

  return { checked: payments.length, discrepancies };
}
