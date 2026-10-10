import { z } from "zod";

import { RESERVATION_STATUSES } from "@/app/lib/models";

/**
 * Server-side validation for the reservation endpoints.
 *
 * The app mirrors these rules for instant feedback, but the API can never
 * trust that: these are the ones protecting the database.
 */

/** Header the client sends to make `POST /api/reservations` replayable. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/**
 * How far ahead a slot may be booked. Not a business rule so much as a sanity
 * bound: a reservation for the year 3000 is a bug or an attack, never a user.
 */
export const MAX_BOOKING_DAYS_AHEAD = 365;

/**
 * Idempotency keys are opaque to us — we only ever compare them — so the rules
 * are about storage, not meaning: long enough to be unique (a UUID is 36),
 * short enough not to be a payload, and no whitespace so a copy-paste accident
 * can't create a second "distinct" key that looks identical in a log.
 */
export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency key too short")
  .max(255, "Idempotency key too long")
  .regex(/^[A-Za-z0-9_:.-]+$/, "Idempotency key has invalid characters");

/**
 * Reads and validates the idempotency key from the request headers.
 *
 * Required rather than optional: without one a retry is indistinguishable from
 * a second booking, and "the client forgot" is exactly when duplicates happen.
 */
export function parseIdempotencyKey(
  request: Request,
): { ok: true; key: string } | { ok: false; message: string } {
  const raw = request.headers.get(IDEMPOTENCY_HEADER);

  if (!raw) {
    return { ok: false, message: `Missing ${IDEMPOTENCY_HEADER} header` };
  }

  const parsed = IdempotencyKeySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  return { ok: true, key: parsed.data };
}

const objectIdField = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Not a valid id");

/**
 * A slot must be a real instant in the future.
 *
 * Parsed from ISO rather than accepting a timestamp number: the app and the
 * API have to agree on a timezone, and an ISO string with its offset is the
 * only form that says so out loud.
 */
const scheduledForField = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Not a valid date",
  })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() > Date.now(), {
    message: "Cannot book a slot in the past",
  })
  .refine(
    (date) =>
      date.getTime() <=
      Date.now() + MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000,
    { message: `Cannot book more than ${MAX_BOOKING_DAYS_AHEAD} days ahead` },
  );

/** `POST /api/reservations`. */
export const CreateReservationSchema = z.object({
  serviceId: objectIdField,
  scheduledFor: scheduledForField,
});

export type CreateReservationInputType = z.input<
  typeof CreateReservationSchema
>;

export type CreateReservationDataType = z.output<
  typeof CreateReservationSchema
>;

/** Query params for `GET /api/reservations`. */
export const ReservationListFiltersSchema = z.object({
  /**
   * Which side of the booking the caller is asking about. Defaults to
   * `customer`: the common case is "my bookings", and a provider asking for
   * their inbox is the one who knows to say so.
   */
  role: z.enum(["customer", "provider"]).default("customer"),
  status: z.enum(RESERVATION_STATUSES).optional(),
});

export type ReservationListFiltersType = z.output<
  typeof ReservationListFiltersSchema
>;
