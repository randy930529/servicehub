import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { Service, ServicePage } from "@/features/services/domain/types";
import { getServices } from "@/features/services/domain/use-cases";
import { useServicesQuery } from "@/features/services/queries/use-services-query";

jest.mock("@/features/services/domain/use-cases", () => ({
  getServices: jest.fn(),
}));

const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;

function makeService(id: string): Service {
  return {
    id,
    name: `Servicio ${id}`,
    description: "desc",
    category: "hogar",
    priceFromCents: 45000,
    rating: 4.8,
    ratingAverage: 4.8,
    reviewCount: 3,
    providerName: "CleanPro",
    imageUrl: null,
    ownerId: null,
    location: null,
  };
}

function page(items: Service[], overrides: Partial<ServicePage> = {}): ServicePage {
  return {
    items,
    page: 1,
    hasNextPage: false,
    total: items.length,
    ...overrides,
  };
}

const clients: QueryClient[] = [];
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useServicesQuery", () => {
  beforeEach(() => {
    mockGetServices.mockReset();
  });

  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.length = 0;
  });

  test("returns the flattened catalog on success", async () => {
    mockGetServices.mockResolvedValue(page([makeService("svc-1")]));

    const { result } = await renderHook(() => useServicesQuery(), {
      wrapper: createWrapper(),
    });

    // The initial pending state is covered reliably by the screen test
    // (catalog-loading); asserting it here races with the mock resolving.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([makeService("svc-1")]);
    expect(mockGetServices).toHaveBeenCalledWith({}, 1);
  });

  test("passes the active filters through to the use-case", async () => {
    mockGetServices.mockResolvedValue(page([]));
    const filters = { q: "masaje", category: "bienestar" } as const;

    const { result } = await renderHook(() => useServicesQuery(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetServices).toHaveBeenCalledWith(filters, 1);
  });

  test("appends the next page instead of replacing the list", async () => {
    mockGetServices
      .mockResolvedValueOnce(
        page([makeService("svc-1")], { hasNextPage: true, total: 2 }),
      )
      .mockResolvedValueOnce(page([makeService("svc-2")], { page: 2, total: 2 }));

    const { result } = await renderHook(() => useServicesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    void result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(result.current.data?.items.map((item) => item.id)).toEqual([
      "svc-1",
      "svc-2",
    ]);
    expect(mockGetServices).toHaveBeenLastCalledWith({}, 2);
    expect(result.current.hasNextPage).toBe(false);
  });

  test("surfaces an error when the use-case rejects", async () => {
    mockGetServices.mockRejectedValue(new Error("boom"));

    const { result } = await renderHook(() => useServicesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
