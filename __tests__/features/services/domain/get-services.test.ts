import { getServices } from "@/features/services/domain/use-cases/get-services";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

describe("getServices", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("resolves with a non-empty list of services", async () => {
    const promise = getServices();
    jest.advanceTimersByTime(600);
    const services = await promise;

    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(0);
  });

  test("returns services with the expected shape", async () => {
    const promise = getServices();
    jest.advanceTimersByTime(600);
    const [service] = await promise;

    expect(service).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        priceFromCents: expect.any(Number),
        rating: expect.any(Number),
        providerName: expect.any(String),
      }),
    );
  });

  test("returns unique service ids", async () => {
    const promise = getServices();
    jest.advanceTimersByTime(600);
    const services = await promise;

    const ids = services.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
