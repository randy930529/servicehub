import type {
  Service,
  ServiceCategory,
  ServiceFilters,
  ServiceInput,
  ServiceLocation,
} from "../types";

/** A service as returned by the backend (Mongo `_id`, derived `imageUrl`). */
export interface ApiService {
  _id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  rating: number;
  ratingAverage?: number;
  reviewCount?: number;
  providerName: string;
  imageUrl?: string | null;
  ownerId?: string | null;
  location?: ServiceLocation | null;
  distanceKm?: number;
}

export interface ApiServicePage {
  data: ApiService[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** Response shape of every single-service endpoint (create, update, detail). */
export interface ApiServiceResponse {
  service: ApiService;
}

/** Maps the API shape (`_id`, Mongo fields) to the domain `Service` (`id`). */
export function toService(api: ApiService): Service {
  return {
    id: api._id,
    name: api.name,
    description: api.description,
    category: api.category,
    priceFromCents: api.priceFromCents,
    rating: api.rating,
    // Older payloads predate reputation; default rather than render NaN.
    ratingAverage: api.ratingAverage ?? 0,
    reviewCount: api.reviewCount ?? 0,
    providerName: api.providerName,
    imageUrl: api.imageUrl ?? null,
    ownerId: api.ownerId ?? null,
    location: api.location ?? null,
    // Left undefined rather than defaulted: "we didn't measure" and "it's 0 km
    // away" must not look the same to the UI.
    ...(api.distanceKm !== undefined ? { distanceKm: api.distanceKm } : {}),
  };
}

/**
 * Turns domain filters into query params.
 *
 * Empty values are omitted rather than sent blank, so the request URL — and
 * therefore the React Query cache key and any HTTP cache — stays stable when a
 * filter is off.
 */
export function toServiceQueryParams(
  filters: ServiceFilters,
  page: number,
  limit: number,
): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit };

  const q = filters.q?.trim();
  if (q) params.q = q;
  if (filters.category) params.category = filters.category;
  if (filters.sort) params.sort = filters.sort;
  if (filters.mineOnly) params.owner = "me";

  if (filters.near) {
    params.lat = filters.near.lat;
    params.lng = filters.near.lng;
    params.radiusKm = filters.near.radiusKm;
  }

  return params;
}

/**
 * Body for create/update. `location` and `imageKey` are only sent when the
 * caller explicitly set them — including to `null`, which is how the API is
 * told to clear a value rather than leave it untouched.
 */
export function toServiceBody(
  input: ServiceInput | Partial<ServiceInput>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.category !== undefined) body.category = input.category;
  if (input.priceFromCents !== undefined) {
    body.priceFromCents = input.priceFromCents;
  }
  if (input.providerName !== undefined) body.providerName = input.providerName;
  if (input.imageKey !== undefined) body.imageKey = input.imageKey;
  if (input.location !== undefined) body.location = input.location;

  return body;
}
