import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import { getServices } from "@/features/services/domain/use-cases/get-services";
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
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

describe("getServices", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("requests the catalog endpoint", async () => {
    mockGet.mockResolvedValue({ data: { data: [], meta: {} } });

    await getServices();

    expect(mockGet).toHaveBeenCalledWith("/api/services", {
      params: { limit: 100 },
    });
  });

  test("maps API `_id` to domain `id` and keeps the expected shape", async () => {
    mockGet.mockResolvedValue({ data: { data: [API_SERVICE], meta: {} } });

    const [service] = await getServices();

    expect(service).toEqual({
      id: "665f1b2c9a1b2c3d4e5f6a7b",
      name: "Limpieza de hogar",
      description: "Limpieza profunda de tu casa.",
      category: "hogar",
      priceFromCents: 45000,
      rating: 4.8,
      providerName: "CleanPro",
    });
    // Mongo-only fields are dropped by the mapper.
    expect(service).not.toHaveProperty("_id");
    expect(service).not.toHaveProperty("createdAt");
  });

  test("returns every service from the response", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [API_SERVICE, { ...API_SERVICE, _id: "second" }],
        meta: {},
      },
    });

    const services = await getServices();

    expect(services).toHaveLength(2);
    expect(services.map((s) => s.id)).toEqual([
      "665f1b2c9a1b2c3d4e5f6a7b",
      "second",
    ]);
  });

  test("propagates errors from the client", async () => {
    mockGet.mockRejectedValue(new Error("Network Error"));

    await expect(getServices()).rejects.toThrow("Network Error");
  });
});
