import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  SERVICES_PAGE_SIZE,
  getServices,
} from "@/features/services/domain/use-cases/get-services";
import { apiClient } from "@/shared/lib/api-client";

jest.mock("@/shared/lib/api-client", () => ({
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const API_SERVICE = {
  _id: "665f1b2c9a1b2c3d4e5f6a7b",
  name: "Limpieza de hogar",
  description: "Limpieza profunda de tu casa.",
  category: "hogar",
  priceFromCents: 45000,
  rating: 4.8,
  providerName: "CleanPro",
  imageUrl: "http://localhost:9000/service-images/u1/a.jpg",
  ownerId: "user-1",
  location: { lat: 20.6597, lng: -103.3496 },
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

const META = {
  page: 1,
  limit: SERVICES_PAGE_SIZE,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

function respondWith(data: unknown[], meta: Partial<typeof META> = {}) {
  mockGet.mockResolvedValue({ data: { data, meta: { ...META, ...meta } } });
}

describe("getServices", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("requests the first page with no filters by default", async () => {
    respondWith([]);

    await getServices();

    expect(mockGet).toHaveBeenCalledWith("/api/services", {
      params: { page: 1, limit: SERVICES_PAGE_SIZE },
    });
  });

  test("sends every active filter as a query param", async () => {
    respondWith([]);

    await getServices(
      {
        q: "limpieza",
        category: "hogar",
        sort: "price_asc",
        near: { lat: 20.6597, lng: -103.3496, radiusKm: 5 },
      },
      2,
    );

    expect(mockGet).toHaveBeenCalledWith("/api/services", {
      params: {
        page: 2,
        limit: SERVICES_PAGE_SIZE,
        q: "limpieza",
        category: "hogar",
        sort: "price_asc",
        lat: 20.6597,
        lng: -103.3496,
        radiusKm: 5,
      },
    });
  });

  test("omits empty filters instead of sending them blank", async () => {
    respondWith([]);

    // A blank search box must produce the same request as no search at all,
    // otherwise it becomes a separate cache entry for identical results.
    await getServices({ q: "   ", category: null, near: null });

    expect(mockGet).toHaveBeenCalledWith("/api/services", {
      params: { page: 1, limit: SERVICES_PAGE_SIZE },
    });
  });

  test("asks the API for the caller's own services with owner=me", async () => {
    respondWith([]);

    await getServices({ mineOnly: true });

    expect(mockGet).toHaveBeenCalledWith("/api/services", {
      params: { page: 1, limit: SERVICES_PAGE_SIZE, owner: "me" },
    });
  });

  test("maps API `_id` to domain `id` and keeps the expected shape", async () => {
    respondWith([API_SERVICE]);

    const { items } = await getServices();

    expect(items[0]).toEqual({
      id: "665f1b2c9a1b2c3d4e5f6a7b",
      name: "Limpieza de hogar",
      description: "Limpieza profunda de tu casa.",
      category: "hogar",
      priceFromCents: 45000,
      rating: 4.8,
      // Absent from this payload: a service that predates reputation reads as
      // "no reviews", never as NaN.
      ratingAverage: 0,
      reviewCount: 0,
      providerName: "CleanPro",
      imageUrl: "http://localhost:9000/service-images/u1/a.jpg",
      ownerId: "user-1",
      location: { lat: 20.6597, lng: -103.3496 },
    });
    // Mongo-only fields are dropped by the mapper.
    expect(items[0]).not.toHaveProperty("_id");
    expect(items[0]).not.toHaveProperty("createdAt");
  });

  test("defaults the optional fields the seeded catalog has no values for", async () => {
    const { imageUrl, ownerId, location, ...seeded } = API_SERVICE;
    respondWith([seeded]);

    const { items } = await getServices();

    expect(items[0].imageUrl).toBeNull();
    expect(items[0].ownerId).toBeNull();
    expect(items[0].location).toBeNull();
  });

  test("reports pagination so the caller knows whether to ask for more", async () => {
    respondWith([API_SERVICE, { ...API_SERVICE, _id: "second" }], {
      page: 2,
      total: 42,
      hasNextPage: true,
    });

    const page = await getServices({}, 2);

    expect(page.items.map((service) => service.id)).toEqual([
      "665f1b2c9a1b2c3d4e5f6a7b",
      "second",
    ]);
    expect(page.page).toBe(2);
    expect(page.total).toBe(42);
    expect(page.hasNextPage).toBe(true);
  });

  test("propagates errors from the client", async () => {
    mockGet.mockRejectedValue(new Error("Network Error"));

    await expect(getServices()).rejects.toThrow("Network Error");
  });
});
