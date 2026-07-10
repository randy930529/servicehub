import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  buildMeta,
  getSkip,
  parsePagination,
} from "../app/lib/helpers/pagination";

describe("parsePagination", () => {
  it("uses defaults when params are missing", () => {
    assert.deepEqual(parsePagination({}), {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  });

  it("parses valid values", () => {
    assert.deepEqual(parsePagination({ page: "3", limit: "25" }), {
      page: 3,
      limit: 25,
    });
  });

  it("falls back on invalid, zero or negative values", () => {
    assert.deepEqual(parsePagination({ page: "abc", limit: "-5" }), {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
    assert.deepEqual(parsePagination({ page: "0", limit: "1.5" }), {
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
    });
  });

  it("caps limit at MAX_LIMIT", () => {
    assert.equal(parsePagination({ limit: "9999" }).limit, MAX_LIMIT);
  });
});

describe("getSkip", () => {
  it("returns 0 for the first page", () => {
    assert.equal(getSkip({ page: 1, limit: 10 }), 0);
  });

  it("skips (page - 1) * limit", () => {
    assert.equal(getSkip({ page: 3, limit: 10 }), 20);
  });
});

describe("buildMeta", () => {
  it("computes totals and flags for a middle page", () => {
    assert.deepEqual(buildMeta({ page: 2, limit: 10 }, 25), {
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });

  it("has no next/prev for a single full page", () => {
    const meta = buildMeta({ page: 1, limit: 10 }, 6);
    assert.equal(meta.totalPages, 1);
    assert.equal(meta.hasNextPage, false);
    assert.equal(meta.hasPrevPage, false);
  });
});
