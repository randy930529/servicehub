import type { ReactElement } from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import type { Service } from "@/features/services/domain/types";
import { getServices } from "@/features/services/domain/use-cases";
import { CatalogScreen } from "@/features/services/screens/catalog-screen";

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

function renderCatalog(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("CatalogScreen", () => {
  beforeEach(() => {
    mockGetServices.mockReset();
  });

  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.length = 0;
  });

  test("shows a loading state while pending", async () => {
    mockGetServices.mockReturnValue(new Promise<Service[]>(() => {}));
    const { getByTestId } = await renderCatalog(<CatalogScreen />);

    expect(getByTestId("catalog-loading")).toBeTruthy();
  });

  test("shows an error state with a retry button that refetches", async () => {
    mockGetServices.mockRejectedValue(new Error("network down"));
    const { findByTestId, getByTestId } = await renderCatalog(
      <CatalogScreen />,
    );

    expect(await findByTestId("catalog-error")).toBeTruthy();
    expect(mockGetServices).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("catalog-retry-button"));
    await waitFor(() => expect(mockGetServices).toHaveBeenCalledTimes(2));
  });

  test("renders the service list on success", async () => {
    mockGetServices.mockResolvedValue(SERVICES);
    const { findByTestId, getByText } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-list")).toBeTruthy();
    expect(await findByTestId("service-card-svc-1")).toBeTruthy();
    expect(getByText("Limpieza de hogar")).toBeTruthy();
  });

  test("shows an empty state when there are no services", async () => {
    mockGetServices.mockResolvedValue([]);
    const { findByTestId } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-empty")).toBeTruthy();
  });
});
