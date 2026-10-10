import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { ZodSubmitHandler, type SubmitError } from "@/app/lib/core";
import type { PublicReservationType } from "@/app/lib/definitions";
import {
  Reservation,
  Service,
  type ReservationDocument,
  type ReservationStatus,
} from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import { buildServiceImageUrl } from "@/app/lib/storage";
import {
  CreateReservationSchema,
  parseIdempotencyKey,
  ReservationListFiltersSchema,
  type CreateReservationDataType,
} from "@/app/lib/validation";

/** Mongo's duplicate-key error. The whole idempotency guarantee hinges on it. */
const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY
  );
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Shape accepted by `toPublicReservation`: loose on purpose so both a hydrated
 * document and a `.lean()` result map through the same function.
 */
type ReservationSourceType = {
  _id: unknown;
  service?: unknown;
  customer: unknown;
  provider: unknown;
  scheduledFor: Date | string;
  status: ReservationStatus;
  priceAtBookingCents: number;
  cancelledAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type PopulatedServiceType = {
  _id: unknown;
  name?: string;
  imageKey?: string | null;
};

/**
 * Maps a stored reservation to the client shape.
 *
 * `service` may be an id or a populated document depending on the query; both
 * are handled so a caller can never accidentally ship a raw ObjectId where the
 * UI expects a name.
 */
export function toPublicReservation(
  source: ReservationSourceType,
): PublicReservationType {
  const service = source.service as PopulatedServiceType | null | undefined;
  const populated = Boolean(service && typeof service === "object" && "name" in service);

  return {
    _id: String(source._id),
    service: {
      id: String(populated ? service?._id : source.service),
      name: populated ? (service?.name ?? "") : "",
      imageUrl: populated ? buildServiceImageUrl(service?.imageKey) : null,
    },
    customerId: String(source.customer),
    providerId: String(source.provider),
    scheduledFor: toIsoString(source.scheduledFor) ?? "",
    status: source.status,
    priceAtBookingCents: source.priceAtBookingCents,
    cancelledAt: toIsoString(source.cancelledAt),
    createdAt: toIsoString(source.createdAt),
    updatedAt: toIsoString(source.updatedAt),
  };
}

/**
 * `POST /api/reservations` — books a slot, exactly once.
 *
 * Retry safety is delegated to a unique index on `{ customer, idempotencyKey }`
 * rather than a "does it already exist?" read: under two concurrent retries
 * both reads would miss and both would insert. Here the loser gets a
 * duplicate-key error and is answered with the booking the winner made.
 */
export class CreateReservation extends ZodSubmitHandler<
  CreateReservationDataType,
  ReservationDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(Reservation, config);
  }

  protected schema(): ZodType<CreateReservationDataType> {
    return CreateReservationSchema as unknown as ZodType<CreateReservationDataType>;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const idempotency = parseIdempotencyKey(request);
    if (!idempotency.ok) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: idempotency.message },
        400,
      );
    }

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    const { serviceId, scheduledFor } = parsed.data;

    await connectToDatabase();

    const service = await Service.findById(serviceId);
    if (!service) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Service not found" },
        404,
      );
    }

    // The seeded catalog has no owner, so there is nobody to show up. Failing
    // closed beats creating a reservation whose provider is null.
    if (!service.owner) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "This service has no provider" },
        409,
      );
    }

    if (String(service.owner) === auth.user.id) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "You cannot book your own service" },
        409,
      );
    }

    try {
      const reservation = await Reservation.create({
        service: service._id,
        customer: auth.user._id,
        provider: service.owner,
        scheduledFor,
        // Snapshot: the provider may reprice tomorrow, but this is what was
        // agreed today.
        priceAtBookingCents: service.priceFromCents,
        idempotencyKey: idempotency.key,
      });

      await reservation.populate("service", "name imageKey");

      return NextResponse.json(
        { reservation: toPublicReservation(reservation) },
        { status: 201 },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      return this.replay(idempotency.key, auth.user.id, serviceId, scheduledFor);
    }
  }

  /**
   * Answers a retry of a key we have already seen.
   *
   * A replay with a *different* body is not a retry, it is a bug or a reused
   * key: returning the original booking there would tell the user they booked
   * something they did not. That case gets a 409 instead.
   */
  private async replay(
    key: string,
    customerId: string,
    serviceId: string,
    scheduledFor: Date,
  ) {
    const existing = await Reservation.findOne({
      customer: customerId,
      idempotencyKey: key,
    }).populate("service", "name imageKey");

    // Vanishingly unlikely (the key collided a moment ago) but possible if the
    // original was deleted in between. Treat it as a conflict rather than
    // pretending we have the booking.
    if (!existing) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Could not replay that request" },
        409,
      );
    }

    const sameRequest =
      String(existing.service?._id ?? existing.service) === serviceId &&
      existing.scheduledFor.getTime() === scheduledFor.getTime();

    if (!sameRequest) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "That idempotency key was used for a different reservation",
        },
        409,
      );
    }

    // 200, not 201: this request created nothing.
    return NextResponse.json(
      { reservation: toPublicReservation(existing) },
      { status: 200 },
    );
  }
}

type CancelResultType =
  | { ok: true; reservation: PublicReservationType }
  | { ok: false; status: number; message: string };

/**
 * `POST /api/reservations/:id/cancel` — called by either side of the booking.
 *
 * Cancelling is idempotent by nature: asking twice leaves the same state, so a
 * second call succeeds instead of erroring. That is what makes it safe to
 * retry from a flaky phone.
 */
export async function cancelReservation(
  id: string,
  userId: string,
): Promise<CancelResultType> {
  // `findById` throws a CastError on a malformed id; answer 404 like any other
  // id that matches nothing.
  if (!isValidObjectId(id)) {
    return { ok: false, status: 404, message: "Reservation not found" };
  }

  await connectToDatabase();

  const reservation = await Reservation.findById(id).populate(
    "service",
    "name imageKey",
  );

  if (!reservation) {
    return { ok: false, status: 404, message: "Reservation not found" };
  }

  // Both the customer and the provider may cancel; nobody else may even know
  // it exists, so a stranger gets 404 rather than 403.
  const involved =
    String(reservation.customer) === userId ||
    String(reservation.provider) === userId;

  if (!involved) {
    return { ok: false, status: 404, message: "Reservation not found" };
  }

  if (reservation.status === "cancelled") {
    return { ok: true, reservation: toPublicReservation(reservation) };
  }

  reservation.status = "cancelled";
  reservation.cancelledAt = new Date();
  await reservation.save();

  return { ok: true, reservation: toPublicReservation(reservation) };
}

/**
 * `GET /api/reservations` — the caller's bookings, as customer or as provider.
 *
 * Always scoped to the authenticated user: there is no "all reservations"
 * query to accidentally expose.
 */
export async function listReservations(
  userId: string,
  searchParams: URLSearchParams,
): Promise<PublicReservationType[]> {
  const filters = ReservationListFiltersSchema.parse({
    role: searchParams.get("role") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  await connectToDatabase();

  const query: Record<string, unknown> =
    filters.role === "provider" ? { provider: userId } : { customer: userId };

  if (filters.status) query.status = filters.status;

  const reservations = await Reservation.find(query)
    .sort({ scheduledFor: -1 })
    .populate("service", "name imageKey")
    .lean();

  return reservations.map((item) =>
    toPublicReservation(item as unknown as ReservationSourceType),
  );
}
