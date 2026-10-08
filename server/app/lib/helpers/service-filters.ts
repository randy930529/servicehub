import { SERVICE_CATEGORIES, type ServiceCategory } from "@/app/lib/models";

import {
  EARTH_RADIUS_KM,
  MAX_RADIUS_KM,
  type SearchCenterType,
} from "@/app/lib/helpers";

/**
 * Query-string → MongoDB filter for `GET /api/services`.
 *
 * Kept as a pure function (no DB, no Request) so every combination of filters
 * can be unit-tested without a database.
 *
 * Forgiving by design, like `parsePagination`: an unparseable value is dropped
 * rather than rejected, so a stale client can never 400 the whole catalog.
 */

export const SERVICE_SORTS = [
  "relevance",
  "recent",
  "price_asc",
  "price_desc",
  "rating",
  "distance",
] as const;

export type ServiceSortType = (typeof SERVICE_SORTS)[number];

export type ServiceFilterInputType = {
  q?: string | null;
  category?: string | null;
  /** Prices are in MXN cents, same unit the documents store. */
  minPrice?: string | null;
  maxPrice?: string | null;
  lat?: string | null;
  lng?: string | null;
  radiusKm?: string | null;
  sort?: string | null;
};

type PriceRange = { $gte?: number; $lte?: number };

type GeoWithin = {
  $geoWithin: { $centerSphere: [[number, number], number] };
};

export type ServiceQueryType = {
  $text?: { $search: string };
  category?: ServiceCategory;
  priceFromCents?: PriceRange;
  location?: GeoWithin;
};

export type ParsedServiceFiltersType = {
  filter: ServiceQueryType;
  sort: Record<string, 1 | -1 | { $meta: "textScore" }>;
  /** True when the query ranks by text score, which needs a score projection. */
  usesTextScore: boolean;
  /**
   * Centre of the proximity search, when the caller gave one. The route needs
   * it twice: to rank by distance, and to tell every result how far away it is.
   */
  center: SearchCenterType | null;
  /**
   * True when results must be ordered by distance, which Mongo can only do
   * through `$geoNear` — the route switches to an aggregation for it.
   */
  usesGeoNear: boolean;
};

function toFiniteNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isServiceCategory(value: string): value is ServiceCategory {
  return (SERVICE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Distance is expressed as `$geoWithin`/`$centerSphere` rather than `$geoNear`
 * on purpose: `$geoNear` must be the first aggregation stage and cannot carry a
 * `$text` predicate, so it could never combine with the search box. The trade
 * is that the query filters by radius without computing the exact distance.
 */
function parseCenter(input: ServiceFilterInputType): SearchCenterType | null {
  const lat = toFiniteNumber(input.lat);
  const lng = toFiniteNumber(input.lng);
  const radiusKm = toFiniteNumber(input.radiusKm);

  // All three or nothing — a radius without a centre means nothing.
  if (lat === null || lng === null || radiusKm === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (radiusKm <= 0) return null;

  return { lat, lng, radiusKm: Math.min(radiusKm, MAX_RADIUS_KM) };
}

/** The centre, expressed the way a plain `find()` can filter by it. */
function toGeoWithin(center: SearchCenterType): GeoWithin {
  return {
    $geoWithin: {
      // GeoJSON order: [longitude, latitude]. `$centerSphere` wants radians.
      $centerSphere: [
        [center.lng, center.lat],
        center.radiusKm / EARTH_RADIUS_KM,
      ],
    },
  };
}

function parsePriceRange(input: ServiceFilterInputType): PriceRange | null {
  const min = toFiniteNumber(input.minPrice);
  const max = toFiniteNumber(input.maxPrice);

  const range: PriceRange = {};
  if (min !== null && min >= 0) range.$gte = Math.round(min);
  if (max !== null && max >= 0) range.$lte = Math.round(max);

  // An inverted range would silently return nothing; drop the bound that makes
  // it impossible instead of answering an empty catalog.
  if (
    range.$gte !== undefined &&
    range.$lte !== undefined &&
    range.$gte > range.$lte
  ) {
    delete range.$lte;
  }

  return Object.keys(range).length > 0 ? range : null;
}

function parseSort(
  requested: string | null | undefined,
  hasText: boolean,
  hasCenter: boolean,
): {
  sort: ParsedServiceFiltersType["sort"];
  usesTextScore: boolean;
  usesGeoNear: boolean;
} {
  const value = (requested ?? "").trim() as ServiceSortType;
  const known = (SERVICE_SORTS as readonly string[]).includes(value);

  // With a search term, relevance is the only sane default: newest-first would
  // bury the best match under whatever was created last.
  let sort: ServiceSortType = known ? value : hasText ? "relevance" : "recent";

  if (sort === "distance") {
    // Two ways to ask for something impossible, both answered by degrading the
    // *ordering* and never the results:
    //   - no centre: there is nothing to measure from.
    //   - a search term: `$geoNear` must be the first stage and cannot carry
    //     `$text`, so ranking by distance would mean dropping the search.
    //     Wrong results are worse than a surprising order, so the text wins.
    // Either way `center` still travels, so responses keep their `distanceKm`.
    if (!hasCenter) sort = "recent";
    else if (hasText) sort = "relevance";
    else return { sort: {}, usesTextScore: false, usesGeoNear: true };
  }

  switch (sort) {
    case "relevance":
      return hasText
        ? {
            sort: { score: { $meta: "textScore" }, createdAt: -1 },
            usesTextScore: true,
            usesGeoNear: false,
          }
        : { sort: { createdAt: -1 }, usesTextScore: false, usesGeoNear: false };
    case "price_asc":
      return {
        sort: { priceFromCents: 1, createdAt: -1 },
        usesTextScore: false,
        usesGeoNear: false,
      };
    case "price_desc":
      return {
        sort: { priceFromCents: -1, createdAt: -1 },
        usesTextScore: false,
        usesGeoNear: false,
      };
    case "rating":
      return {
        sort: { rating: -1, createdAt: -1 },
        usesTextScore: false,
        usesGeoNear: false,
      };
    case "recent":
    default:
      return {
        sort: { createdAt: -1 },
        usesTextScore: false,
        usesGeoNear: false,
      };
  }
}

export function parseServiceFilters(
  input: ServiceFilterInputType,
): ParsedServiceFiltersType {
  const filter: ServiceQueryType = {};

  const q = input.q?.trim();
  if (q) filter.$text = { $search: q };

  const category = input.category?.trim();
  if (category && isServiceCategory(category)) filter.category = category;

  const price = parsePriceRange(input);
  if (price) filter.priceFromCents = price;

  const center = parseCenter(input);
  if (center) filter.location = toGeoWithin(center);

  const { sort, usesTextScore, usesGeoNear } = parseSort(
    input.sort,
    Boolean(q),
    Boolean(center),
  );

  return { filter, sort, usesTextScore, center, usesGeoNear };
}
