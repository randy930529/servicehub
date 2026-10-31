import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * One row per Stripe event we have already processed.
 *
 * Week 15 deduped by *status*: a repeated `payment_intent.succeeded` changed
 * nothing because the payment was already `succeeded`. That works for a state
 * machine and breaks for anything cumulative — two partial refunds are two
 * legitimate events, and a replay of one would be counted twice.
 *
 * Deduping by event id is the general answer: Stripe guarantees the id is
 * stable across retries, so "have I seen this exact event?" is the only
 * question that works for every event type.
 */
const webhookEventSchema = new Schema(
  {
    /** Stripe's `evt_…`. The unique index is the whole mechanism. */
    stripeEventId: { type: String, required: true },
    type: { type: String, required: true },
    /** What the handler did, kept for the runbook's reconciliation steps. */
    outcome: { type: String, default: null },
  },
  { timestamps: true },
);

/**
 * The database arbitrates, as everywhere else in this codebase: two retries
 * arriving at once would both pass a read-then-write check, and the loser of
 * the insert is the one that must do nothing.
 */
webhookEventSchema.index({ stripeEventId: 1 }, { unique: true });

/** Lets the runbook ask "what arrived in the last hour?" without a scan. */
webhookEventSchema.index({ createdAt: -1 });

export type WebhookEventDocument = InferSchemaType<typeof webhookEventSchema>;

export const WebhookEvent: Model<WebhookEventDocument> =
  (models.WebhookEvent as Model<WebhookEventDocument>) ||
  model<WebhookEventDocument>("WebhookEvent", webhookEventSchema);
