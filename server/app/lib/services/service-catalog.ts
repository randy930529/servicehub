import { isValidObjectId, type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import {
  authenticateRequest,
  authErrorResponse as authError,
  getBearerToken,
} from "@/app/lib/auth";
import {
  AbstractSubmitHandler,
  ZodSubmitHandler,
  type SubmitError,
} from "@/app/lib/core";
import type { PublicServiceType } from "@/app/lib/definitions";
import { distanceKmBetween, type CoordinatesType } from "@/app/lib/helpers";
import { Service, type ServiceCategory, type ServiceDocument } from "@/app/lib/models";
import {
  buildServiceImageUrl,
  createServiceImageUploadUrl,
  deleteServiceImageObject,
  getServiceImageMaxBytes,
  headServiceImageObject,
  isAllowedServiceImageContentType,
  isOwnedServiceImageKey,
} from "@/app/lib/storage";
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  buildServiceImageUploadRequestSchema,
  type CreateServiceInputType,
  type ServiceImageUploadRequestInputType,
  type ServiceLocationInputType,
  type UpdateServiceInputType,
} from "@/app/lib/validation";

/**
 * Shape accepted by `toPublicService`: loose on purpose so both a hydrated
 * document and a `.lean()` result map through the same function.
 */
type ServiceSourceType = {
  _id: unknown;
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  rating: number;
  ratingAverage?: number;
  reviewCount?: number;
  providerName: string;
  owner?: unknown;
  imageKey?: string | null;
  location?: { type?: string; coordinates?: number[] } | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Maps a stored service to the client shape (keys out, derived URL in).
 *
 * `center` is the point a proximity search was run around. When given, every
 * result carries how far it is — computed here rather than read from
 * `$geoNear`, so the field looks the same whichever query shape produced it.
 */
export function toPublicService(
  source: ServiceSourceType,
  center?: CoordinatesType | null,
): PublicServiceType {
  const coordinates = source.location?.coordinates;
  const location =
    coordinates && coordinates.length === 2
      ? { lng: coordinates[0], lat: coordinates[1] }
      : null;

  return {
    _id: String(source._id),
    name: source.name,
    description: source.description,
    category: source.category,
    priceFromCents: source.priceFromCents,
    rating: source.rating,
    ratingAverage: source.ratingAverage ?? 0,
    reviewCount: source.reviewCount ?? 0,
    providerName: source.providerName,
    imageUrl: buildServiceImageUrl(source.imageKey),
    ownerId: source.owner ? String(source.owner) : null,
    // Stored as GeoJSON `[lng, lat]`; handed to clients the way humans read it.
    location,
    ...(center && location
      ? { distanceKm: distanceKmBetween(center, location) }
      : {}),
    createdAt: toIsoString(source.createdAt),
    updatedAt: toIsoString(source.updatedAt),
  };
}

/** GeoJSON point for storage, or `null` to clear the location. */
function toGeoPoint(location: ServiceLocationInputType | null | undefined) {
  if (!location) return null;
  return { type: "Point" as const, coordinates: [location.lng, location.lat] };
}

/** Removing a superseded image must never fail the request that replaced it. */
function deleteImageInBackground(key: string) {
  void deleteServiceImageObject(key).catch((error) => {
    console.error(`Failed to delete service image ${key}`, error);
  });
}

type ImageCheckType =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * The client is not trusted about images: the key must sit under the caller's
 * own prefix, and the object is inspected in storage — it must exist and
 * respect the type/size limits — before it can be attached to a service.
 */
async function verifyServiceImage(
  key: string,
  userId: string,
): Promise<ImageCheckType> {
  if (!isOwnedServiceImageKey(key, userId)) {
    return { ok: false, status: 403, message: "Key does not belong to you" };
  }

  const object = await headServiceImageObject(key);
  if (!object) {
    return { ok: false, status: 400, message: "No upload found for that key" };
  }

  const maxBytes = getServiceImageMaxBytes();
  if (object.contentLength > maxBytes) {
    deleteImageInBackground(key);
    return {
      ok: false,
      status: 413,
      message: `Image is larger than ${maxBytes} bytes`,
    };
  }

  if (object.contentType && !isAllowedServiceImageContentType(object.contentType)) {
    deleteImageInBackground(key);
    return {
      ok: false,
      status: 415,
      message: "Unsupported image type. Use JPEG, PNG or WebP",
    };
  }

  return { ok: true };
}

type OwnedServiceType =
  | { ok: true; service: HydratedDocument<ServiceDocument> }
  | { ok: false; response: NextResponse<SubmitError> };

/**
 * Loads a service and checks the caller owns it.
 *
 * A malformed id is answered as 404, not 500 — `findById` would throw a
 * CastError on it. Seeded services have no owner, so they fail the check: the
 * guard is closed by default rather than open.
 */
async function loadOwnedService(
  id: string,
  userId: string,
  respond: (error: SubmitError, status: number) => NextResponse<SubmitError>,
): Promise<OwnedServiceType> {
  if (!isValidObjectId(id)) {
    return {
      ok: false,
      response: respond(
        { type: "VALIDATION_ERROR", message: "Service not found" },
        404,
      ),
    };
  }

  const service = await Service.findById(id);
  if (!service) {
    return {
      ok: false,
      response: respond(
        { type: "VALIDATION_ERROR", message: "Service not found" },
        404,
      ),
    };
  }

  if (!service.owner || String(service.owner) !== userId) {
    return {
      ok: false,
      response: respond(
        { type: "VALIDATION_ERROR", message: "This service is not yours" },
        403,
      ),
    };
  }

  return { ok: true, service };
}

/** `POST /api/services` — publishes a service owned by the caller. */
export class CreateService extends ZodSubmitHandler<
  CreateServiceInputType,
  ServiceDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(Service, config);
  }

  protected schema(): ZodType<CreateServiceInputType> {
    return CreateServiceSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);
    const { imageKey, location, providerName, ...fields } = parsed.data;

    if (imageKey) {
      const check = await verifyServiceImage(imageKey, auth.user.id);
      if (!check.ok) {
        return this.handleError(
          { type: "VALIDATION_ERROR", message: check.message },
          check.status,
        );
      }
    }

    const service = await Service.create({
      ...fields,
      // A brand-new service has no reviews yet; ratings arrive with bookings.
      rating: 0,
      providerName: providerName ?? auth.user.name,
      owner: auth.user._id,
      imageKey: imageKey ?? null,
      location: toGeoPoint(location),
    });

    return NextResponse.json({ service: toPublicService(service) }, { status: 201 });
  }
}

/** `PATCH /api/services/:id` — partial update, owner only. */
export class UpdateService extends ZodSubmitHandler<
  UpdateServiceInputType,
  ServiceDocument
> {
  private readonly id: string;

  constructor(config: { endpoint: string; method: "PATCH"; id: string }) {
    super(Service, config);
    this.id = config.id;
  }

  protected schema(): ZodType<UpdateServiceInputType> {
    return UpdateServiceSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    const owned = await loadOwnedService(this.id, auth.user.id, (error, status) =>
      this.handleError(error, status),
    );
    if (!owned.ok) return owned.response;

    this.setData(parsed.data);
    const { service } = owned;
    const data = parsed.data;

    // Only the keys actually sent are touched, so a PATCH never blanks a field
    // the client didn't mention.
    if (data.name !== undefined) service.name = data.name;
    if (data.description !== undefined) service.description = data.description;
    if (data.category !== undefined) service.category = data.category;
    if (data.priceFromCents !== undefined) {
      service.priceFromCents = data.priceFromCents;
    }
    if (data.providerName !== undefined) service.providerName = data.providerName;
    if (data.location !== undefined) service.location = toGeoPoint(data.location);

    let supersededKey: string | null = null;
    if (data.imageKey !== undefined) {
      if (data.imageKey) {
        const check = await verifyServiceImage(data.imageKey, auth.user.id);
        if (!check.ok) {
          return this.handleError(
            { type: "VALIDATION_ERROR", message: check.message },
            check.status,
          );
        }
      }
      if (service.imageKey && service.imageKey !== data.imageKey) {
        supersededKey = service.imageKey;
      }
      service.imageKey = data.imageKey;
    }

    await service.save();

    // Only after the new key is safely persisted — a failed save would
    // otherwise leave the service pointing at a deleted object.
    if (supersededKey) deleteImageInBackground(supersededKey);

    return NextResponse.json({ service: toPublicService(service) });
  }
}

/** `DELETE /api/services/:id` — owner only; takes the image with it. */
export class DeleteService extends AbstractSubmitHandler<string, ServiceDocument> {
  private readonly id: string;

  constructor(config: { endpoint: string; method: "DELETE"; id: string }) {
    super(Service, config);
    this.id = config.id;
  }

  parseBody(request: Request) {
    return getBearerToken(request);
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const owned = await loadOwnedService(this.id, auth.user.id, (error, status) =>
      this.handleError(error, status),
    );
    if (!owned.ok) return owned.response;

    const { imageKey } = owned.service;
    await owned.service.deleteOne();
    if (imageKey) deleteImageInBackground(imageKey);

    return NextResponse.json({ deleted: true, _id: this.id });
  }
}

/**
 * `POST /api/services/image/upload-url` — presigned PUT so the app uploads
 * straight to storage; the image bytes never touch this server.
 */
export class CreateServiceImageUploadUrl extends ZodSubmitHandler<
  ServiceImageUploadRequestInputType,
  ServiceDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(Service, config);
  }

  protected schema(): ZodType<ServiceImageUploadRequestInputType> {
    return buildServiceImageUploadRequestSchema();
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);

    const target = await createServiceImageUploadUrl(
      auth.user.id,
      parsed.data.contentType,
    );

    return NextResponse.json({ ...target, maxBytes: getServiceImageMaxBytes() });
  }
}
