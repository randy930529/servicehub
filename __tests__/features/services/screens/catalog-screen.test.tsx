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

import type { Service, ServicePage } from "@/features/services/domain/types";
import { getServices } from "@/features/services/domain/use-cases";
import { CatalogScreen } from "@/features/services/screens/catalog-screen";

jest.mock("@/features/services/domain/use-cases", () => ({
  getServices: jest.fn(),
}));

const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;

const SERVICE: Service = {
  id: "svc-1",
  name: "Limpieza de hogar",
  description: "desc",
  category: "hogar",
  priceFromCents: 45000,
  rating: 4.8,
  providerName: "CleanPro",
  imageUrl: null,
  ownerId: null,
  location: null,
};

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

function renderCatalog(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

// Every `fireEvent` is awaited: they are async in Testing Library 14, and an
// un-awaited one leaves React's act scope open, which breaks later renders.
describe("CatalogScreen", () => {
  beforeEach(() => {
    mockGetServices.mockReset();
  });

  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.length = 0;
    jest.useRealTimers();
  });

  test("shows a loading state while pending", async () => {
    mockGetServices.mockReturnValue(new Promise<ServicePage>(() => {}));
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

    await fireEvent.press(getByTestId("catalog-retry-button"));
    await waitFor(() => expect(mockGetServices).toHaveBeenCalledTimes(2));
  });

  test("renders the service list on success", async () => {
    mockGetServices.mockResolvedValue(page([SERVICE]));
    const { findByTestId, getByText } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-list")).toBeTruthy();
    expect(await findByTestId("service-card-svc-1")).toBeTruthy();
    expect(getByText("Limpieza de hogar")).toBeTruthy();
  });

  test("shows an empty state when there are no services", async () => {
    mockGetServices.mockResolvedValue(page([]));
    const { findByTestId, getByText } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-empty")).toBeTruthy();
    expect(getByText("Sin servicios disponibles")).toBeTruthy();
  });

  test("tells the user the filters are what emptied the list", async () => {
    mockGetServices.mockResolvedValue(page([]));
    const { findByTestId, getByTestId, getByText } = await renderCatalog(
      <CatalogScreen />,
    );

    expect(await findByTestId("catalog-empty")).toBeTruthy();

    await fireEvent.press(getByTestId("category-chip-belleza"));

    await waitFor(() => expect(getByText("Sin resultados")).toBeTruthy());
  });

  test("filters by category without waiting for the debounce", async () => {
    mockGetServices.mockResolvedValue(page([SERVICE]));
    const { findByTestId, getByTestId } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-list")).toBeTruthy();

    await fireEvent.press(getByTestId("category-chip-belleza"));

    await waitFor(() =>
      expect(mockGetServices).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "belleza" }),
        1,
      ),
    );
  });

  test("collapses a burst of typing into one request", async () => {
    // Real timers here on purpose: the debounce *timing* is unit-tested in
    // use-debounced-value.test.ts, and mixing fake timers with React Query's
    // scheduler deadlocks `waitFor`. What matters at this level is the effect
    // — four keystrokes must not become four requests.
    mockGetServices.mockResolvedValue(page([SERVICE]));

    const { findByTestId, getByTestId } = await renderCatalog(<CatalogScreen />);
    expect(await findByTestId("catalog-list")).toBeTruthy();
    expect(mockGetServices).toHaveBeenCalledTimes(1);

    const input = getByTestId("services-search-input");
    await fireEvent.changeText(input, "l");
    await fireEvent.changeText(input, "li");
    await fireEvent.changeText(input, "lim");
    await fireEvent.changeText(input, "limp");

    await waitFor(() =>
      expect(mockGetServices).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "limp" }),
        1,
      ),
    );

    // The unfiltered first load plus exactly one search — not one per letter.
    expect(mockGetServices).toHaveBeenCalledTimes(2);
  });
});
