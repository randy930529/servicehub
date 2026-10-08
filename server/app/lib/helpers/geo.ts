/**
 * Geographic maths shared by the catalog filters and the response mapper.
 *
 * Pure functions, no Mongo and no Request: every case here is unit-testable
 * without a database, which matters because an off-by-one in the coordinate
 * order is invisible until a marker lands in the sea.
 */

/** Mean Earth radius. `$centerSphere` measures radians against this. */
export const EARTH_RADIUS_KM = 6378.1;

/** Widest radius accepted; beyond this the filter stops narrowing anything. */
export const MAX_RADIUS_KM = 500;

/** A point in human order. GeoJSON's `[lng, lat]` is built at the edges. */
export type CoordinatesType = {
  lat: number;
  lng: number;
};

/** The centre of a proximity search, plus how far around it to look. */
export type SearchCenterType = CoordinatesType & {
  radiusKm: number;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres (haversine).
 *
 * Used instead of reading `$geoNear`'s `distanceField` so that every response
 * carries the distance the same way, whatever query shape produced it —
 * `$geoNear` only runs when the caller sorts by distance, and a field that
 * appears in some responses and not others is a trap for the client.
 *
 * Treats the Earth as a sphere, so it is off by up to ~0.5% against the real
 * ellipsoid. At the radii this catalog deals with (hundreds of metres to a few
 * kilometres) that is metres, far below GPS error.
 */
export function distanceKmBetween(
  from: CoordinatesType,
  to: CoordinatesType,
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * `$geoNear` stage for a proximity-ordered page.
 *
 * It has to be the **first** stage of the pipeline and cannot carry a `$text`
 * predicate — that limitation is why the catalog filters by `$geoWithin`
 * everywhere else and only reaches for this when the caller asks to rank by
 * distance.
 *
 * `distanceField` is required by Mongo even though the mapper ignores it and
 * recomputes with `distanceKmBetween`; the stage is here for the ordering.
 */
export function buildGeoNearStage(
  center: SearchCenterType,
  query: Record<string, unknown>,
) {
  return {
    $geoNear: {
      // GeoJSON order: [longitude, latitude]. The tuple type is not pedantry:
      // Mongoose rejects a plain `number[]` here, and it is the same two-element
      // contract the `pointSchema` validator enforces on the way in.
      near: {
        type: "Point" as const,
        coordinates: [center.lng, center.lat] as [number, number],
      },
      distanceField: "distanceMeters",
      maxDistance: center.radiusKm * 1000,
      spherical: true,
      query,
    },
  };
}
