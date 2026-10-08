/**
 * Services domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer.
 * No React, no UI, no persistence concerns here.
 */

export type ServiceCategory =
  | "hogar"
  | "belleza"
  | "tecnologia"
  | "bienestar"
  | "automotriz";

/** Coordinates in human order — the API converts to/from GeoJSON internally. */
export interface ServiceLocation {
  lat: number;
  lng: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  /** Starting price in MXN cents (integer, avoids float rounding issues). */
  priceFromCents: number;
  /** Average rating, 0–5. */
  rating: number;
  providerName: string;
  /** Absolute URL of the photo, or `null` when the service has none. */
  imageUrl: string | null;
  /** Who may edit it; `null` for the seeded catalog, which nobody owns. */
  ownerId: string | null;
  location: ServiceLocation | null;
  /**
   * Kilometres from the point the search was centred on. Only present when the
   * request carried a `near` filter — there is nothing to measure from
   * otherwise, so an absent value means "unknown", never "zero".
   */
  distanceKm?: number;
}

/** Ordering the catalog can ask the API for. */
export type ServiceSort =
  | "relevance"
  | "recent"
  | "price_asc"
  | "price_desc"
  | "rating"
  /** Nearest first. Needs a `near` filter; the API falls back without one. */
  | "distance";

/** Radius search around a point. All three values or none. */
export interface ServiceNearFilter extends ServiceLocation {
  radiusKm: number;
}

/** Everything the search screen can narrow the catalog by. */
export interface ServiceFilters {
  /** Free-text query; the API runs it as a full-text search. */
  q?: string;
  category?: ServiceCategory | null;
  near?: ServiceNearFilter | null;
  sort?: ServiceSort;
  /** Restrict to the authenticated user's own services. */
  mineOnly?: boolean;
}

/** One page of results plus what the caller needs to ask for the next one. */
export interface ServicePage {
  items: Service[];
  page: number;
  hasNextPage: boolean;
  total: number;
}

/** Fields a provider sends when creating or editing a service. */
export interface ServiceInput {
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  providerName?: string;
  /** Key from the presigned upload; `null` clears the current photo. */
  imageKey?: string | null;
  location?: ServiceLocation | null;
}

/** Partial edit: a PATCH only sends what actually changed. */
export type ServiceUpdate = Partial<ServiceInput>;

/** Presigned upload target returned by the API (step 1 of the image flow). */
export interface ServiceImageUploadTarget {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  maxBytes: number;
}
