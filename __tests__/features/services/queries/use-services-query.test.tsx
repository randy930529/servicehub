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

import type { Service } from "@/features/services/domain/types";
import { getServices } from "@/features/services/domain/use-cases";
import { useServicesQuery } from "@/features/services/queries/use-services-query";

jest.mock("@/features/services/domain/use-cases", () => ({
  getServices: jest.fn(),
}));

const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;

const SERVICES: Service[] = [
  {
    id: "svc-1",
    name: "Limpieza de hogar",
    description: "desc",
    category: "hogar",
    priceFromCents: 45000,
    rating: 4.8,
    providerName: "CleanPro",
  },
];

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

  test("returns catalog data on success", async () => {
    mockGetServices.mockResolvedValue(SERVICES);

    const { result } = await renderHook(() => useServicesQuery(), {
      wrapper: createWrapper(),
    });

    // The initial pending state is covered reliably by the screen test
    // (catalog-loading); asserting it here races with the mock resolving.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SERVICES);
    expect(mockGetServices).toHaveBeenCalledTimes(1);
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
