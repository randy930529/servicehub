import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildGeoNearStage,
  distanceKmBetween,
  EARTH_RADIUS_KM,
} from "@/app/lib/helpers";

/** Guadalajara centre, the city the seeded catalog sits in. */
const GDL = { lat: 20.6736, lng: -103.344 };

describe("distanceKmBetween", () => {
  test("is zero for the same point", () => {
    assert.equal(distanceKmBetween(GDL, GDL), 0);
  });

  test("measures a known short hop", () => {
    // Guadalajara → Zapopan, ~7 km apart.
    const zapopan = { lat: 20.7214, lng: -103.3918 };
    const km = distanceKmBetween(GDL, zapopan);

    assert.ok(km > 6 && km < 8, `expected ~7 km, got ${km}`);
  });

  test("measures a known long haul", () => {
    // Guadalajara → Mexico City, ~460 km apart.
    const cdmx = { lat: 19.4326, lng: -99.1332 };
    const km = distanceKmBetween(GDL, cdmx);

    assert.ok(km > 450 && km < 475, `expected ~460 km, got ${km}`);
  });

  test("is symmetric", () => {
    const other = { lat: 19.4326, lng: -99.1332 };

    assert.equal(
      distanceKmBetween(GDL, other).toFixed(6),
      distanceKmBetween(other, GDL).toFixed(6),
    );
  });

  test("handles antipodes without NaN", () => {
    // `Math.sqrt` of a value a hair above 1 (floating point) would make `asin`
    // return NaN, which is why the implementation clamps it.
    const km = distanceKmBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });

    assert.ok(Number.isFinite(km));
    assert.ok(Math.abs(km - Math.PI * EARTH_RADIUS_KM) < 1);
  });

  test("crosses the antimeridian the short way", () => {
    // 179° and -179° are 2° apart, not 358°. Getting this wrong puts a marker
    // on the wrong side of the planet.
    const km = distanceKmBetween({ lat: 0, lng: 179 }, { lat: 0, lng: -179 });

    assert.ok(km < 250, `expected ~222 km, got ${km}`);
  });
});

describe("buildGeoNearStage", () => {
  test("puts the centre in GeoJSON order and the radius in metres", () => {
    const stage = buildGeoNearStage({ ...GDL, radiusKm: 5 }, {});

    assert.deepEqual(stage.$geoNear.near, {
      type: "Point",
      // [lng, lat] — reversed from how the centre is written.
      coordinates: [-103.344, 20.6736],
    });
    assert.equal(stage.$geoNear.maxDistance, 5000);
    assert.equal(stage.$geoNear.spherical, true);
  });

  test("carries the remaining filters so the stage can stay first", () => {
    const stage = buildGeoNearStage({ ...GDL, radiusKm: 5 }, {
      category: "hogar",
    });

    assert.deepEqual(stage.$geoNear.query, { category: "hogar" });
  });
});
