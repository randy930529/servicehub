import type { ServiceCategory } from "@/app/lib/models";

/** Coordinates as the API speaks them: human order, not GeoJSON's. */
export type ServiceLocationType = {
  lat: number;
  lng: number;
};

/**
 * A service as sent to clients.
 *
 * Storage keys never cross this boundary — `imageUrl` is derived from the key
 * at read time, the same rule the user avatar follows.
 */
export type PublicServiceType = {
  _id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  rating: number;
  providerName: string;
  imageUrl: string | null;
  /** Who can edit it; `null` for the seeded catalog, which nobody owns. */
  ownerId: string | null;
  location: ServiceLocationType | null;
  /**
   * Kilometres from the centre the caller searched around. Only present when
   * the request carried `lat`/`lng`/`radiusKm` — without a centre there is
   * nothing to measure from.
   */
  distanceKm?: number;
  createdAt: string | null;
  updatedAt: string | null;
};
