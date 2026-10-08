import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseServiceFilters } from "../app/lib/helpers/service-filters";

const EARTH_RADIUS_KM = 6378.1;

describe("text search", () => {
  it("adds a $text clause and ranks by relevance by default", () => {
    const { filter, sort, usesTextScore } = parseServiceFilters({
      q: "limpieza hogar",
    });

    assert.deepEqual(filter.$text, { $search: "limpieza hogar" });
    assert.deepEqual(sort, { score: { $meta: "textScore" }, createdAt: -1 });
    assert.equal(usesTextScore, true);
  });

  it("ignores a blank search box", () => {
    const { filter, sort, usesTextScore } = parseServiceFilters({ q: "   " });

    assert.equal(filter.$text, undefined);
    assert.deepEqual(sort, { createdAt: -1 });
    assert.equal(usesTextScore, false);
  });

  it("never ranks by score without a search term", () => {
    // `relevance` is meaningless with no $text clause: Mongo would reject the
    // $meta sort outright.
    const { sort, usesTextScore } = parseServiceFilters({ sort: "relevance" });

    assert.deepEqual(sort, { createdAt: -1 });
    assert.equal(usesTextScore, false);
  });
});

describe("category filter", () => {
  it("accepts a known category", () => {
    const { filter } = parseServiceFilters({ category: "hogar" });
    assert.equal(filter.category, "hogar");
  });

  it("drops an unknown one instead of returning nothing", () => {
    const { filter } = parseServiceFilters({ category: "submarinismo" });
    assert.equal(filter.category, undefined);
  });
});

describe("price range", () => {
  it("builds a bounded range in cents", () => {
    const { filter } = parseServiceFilters({
      minPrice: "10000",
      maxPrice: "50000",
    });

    assert.deepEqual(filter.priceFromCents, { $gte: 10000, $lte: 50000 });
  });

  it("accepts an open-ended range", () => {
    assert.deepEqual(parseServiceFilters({ minPrice: "10000" }).filter.priceFromCents, {
      $gte: 10000,
    });
    assert.deepEqual(parseServiceFilters({ maxPrice: "50000" }).filter.priceFromCents, {
      $lte: 50000,
    });
  });

  it("drops the impossible bound when the range is inverted", () => {
    const { filter } = parseServiceFilters({
      minPrice: "50000",
      maxPrice: "10000",
    });

    assert.deepEqual(filter.priceFromCents, { $gte: 50000 });
  });

  it("ignores junk and negative values", () => {
    assert.equal(
      parseServiceFilters({ minPrice: "cheap" }).filter.priceFromCents,
      undefined,
    );
    assert.equal(
      parseServiceFilters({ minPrice: "-100" }).filter.priceFromCents,
      undefined,
    );
  });
});

describe("distance filter", () => {
  it("builds a $centerSphere in GeoJSON order and radians", () => {
    const { filter } = parseServiceFilters({
      lat: "20.6597",
      lng: "-103.3496",
      radiusKm: "5",
    });

    assert.deepEqual(filter.location, {
      $geoWithin: {
        // [lng, lat] — the reverse of how the params are named.
        $centerSphere: [[-103.3496, 20.6597], 5 / EARTH_RADIUS_KM],
      },
    });
  });

  it("needs all three params: a radius without a centre means nothing", () => {
    assert.equal(parseServiceFilters({ radiusKm: "5" }).filter.location, undefined);
    assert.equal(
      parseServiceFilters({ lat: "20.65", radiusKm: "5" }).filter.location,
      undefined,
    );
    assert.equal(
      parseServiceFilters({ lat: "20.65", lng: "-103.34" }).filter.location,
      undefined,
    );
  });

  it("rejects out-of-range coordinates", () => {
    assert.equal(
      parseServiceFilters({ lat: "120", lng: "-103.34", radiusKm: "5" }).filter
        .location,
      undefined,
    );
    assert.equal(
      parseServiceFilters({ lat: "20.65", lng: "200", radiusKm: "5" }).filter
        .location,
      undefined,
    );
  });

  it("rejects a non-positive radius", () => {
    assert.equal(
      parseServiceFilters({ lat: "20.65", lng: "-103.34", radiusKm: "0" }).filter
        .location,
      undefined,
    );
  });

  it("caps an absurd radius instead of scanning the planet", () => {
    const { filter } = parseServiceFilters({
      lat: "20.6597",
      lng: "-103.3496",
      radiusKm: "99999",
    });

    assert.deepEqual(filter.location?.$geoWithin.$centerSphere[1], 500 / EARTH_RADIUS_KM);
  });
});

describe("sorting", () => {
  it("maps every supported sort, always with a stable tiebreaker", () => {
    assert.deepEqual(parseServiceFilters({ sort: "recent" }).sort, {
      createdAt: -1,
    });
    assert.deepEqual(parseServiceFilters({ sort: "price_asc" }).sort, {
      priceFromCents: 1,
      createdAt: -1,
    });
    assert.deepEqual(parseServiceFilters({ sort: "price_desc" }).sort, {
      priceFromCents: -1,
      createdAt: -1,
    });
    assert.deepEqual(parseServiceFilters({ sort: "rating" }).sort, {
      rating: -1,
      createdAt: -1,
    });
  });

  it("falls back to newest-first on an unknown sort", () => {
    assert.deepEqual(parseServiceFilters({ sort: "cheapest-ever" }).sort, {
      createdAt: -1,
    });
  });

  it("lets an explicit sort override relevance even with a search term", () => {
    const { sort, usesTextScore } = parseServiceFilters({
      q: "masaje",
      sort: "price_asc",
    });

    assert.deepEqual(sort, { priceFromCents: 1, createdAt: -1 });
    assert.equal(usesTextScore, false);
  });
});

describe("combined filters", () => {
  it("stacks search, category, price and distance in one query", () => {
    const { filter } = parseServiceFilters({
      q: "masaje",
      category: "bienestar",
      minPrice: "20000",
      maxPrice: "80000",
      lat: "20.6597",
      lng: "-103.3496",
      radiusKm: "10",
    });

    assert.deepEqual(filter.$text, { $search: "masaje" });
    assert.equal(filter.category, "bienestar");
    assert.deepEqual(filter.priceFromCents, { $gte: 20000, $lte: 80000 });
    assert.ok(filter.location);
  });

  it("returns an empty filter when nothing is asked for", () => {
    const { filter } = parseServiceFilters({});
    assert.deepEqual(filter, {});
  });
});

describe("sorting by distance", () => {
  const CENTER = { lat: "20.6597", lng: "-103.3496", radiusKm: "5" };

  it("hands the centre to the caller so results can carry their distance", () => {
    const { center } = parseServiceFilters(CENTER);

    assert.deepEqual(center, { lat: 20.6597, lng: -103.3496, radiusKm: 5 });
  });

  it("reports no centre when the caller gave none", () => {
    assert.equal(parseServiceFilters({ sort: "distance" }).center, null);
  });

  it("switches to $geoNear, which does the ordering itself", () => {
    const { sort, usesGeoNear } = parseServiceFilters({
      ...CENTER,
      sort: "distance",
    });

    assert.equal(usesGeoNear, true);
    // `$geoNear` emits results already ordered; a `sort` here would be a
    // second, redundant pass over them.
    assert.deepEqual(sort, {});
  });

  it("still filters by $geoWithin, so the count matches the page", () => {
    const { filter } = parseServiceFilters({ ...CENTER, sort: "distance" });

    assert.ok(filter.location?.$geoWithin);
  });

  it("falls back to recent when there is no centre to measure from", () => {
    const { sort, usesGeoNear } = parseServiceFilters({ sort: "distance" });

    assert.equal(usesGeoNear, false);
    assert.deepEqual(sort, { createdAt: -1 });
  });

  it("keeps the search and degrades the order, never the other way round", () => {
    // `$geoNear` must be the first stage and cannot carry `$text`, so ranking
    // by distance here would mean dropping the search term. Wrong results are
    // worse than a surprising order.
    const { filter, sort, usesGeoNear, usesTextScore, center } =
      parseServiceFilters({ ...CENTER, q: "limpieza", sort: "distance" });

    assert.deepEqual(filter.$text, { $search: "limpieza" });
    assert.equal(usesGeoNear, false);
    assert.equal(usesTextScore, true);
    assert.deepEqual(sort, { score: { $meta: "textScore" }, createdAt: -1 });
    // The centre survives, so every result still reports how far it is.
    assert.ok(center);
  });
});
