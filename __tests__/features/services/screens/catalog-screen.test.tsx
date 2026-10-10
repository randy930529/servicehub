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
  ratingAverage: 4.8,
  reviewCount: 3,
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

describe("CatalogScreen — lista y mapa sincronizados", () => {
  const LOCATED: Service = {
    ...SERVICE,
    id: "svc-geo",
    name: "Jardinería",
    location: { lat: 20.6736, lng: -103.344 },
  };

  beforeEach(() => {
    mockGetServices.mockReset();
  });

  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.length = 0;
    jest.useRealTimers();
  });

  test("starts on the list, so the map never costs anyone a map load they didn't ask for", async () => {
    mockGetServices.mockResolvedValue(page([LOCATED]));
    const { getByTestId, queryByTestId } = await renderCatalog(<CatalogScreen />);

    await waitFor(() => expect(getByTestId("catalog-list")).toBeTruthy());
    expect(queryByTestId("services-map")).toBeNull();
  });

  test("swaps the list for the map and back", async () => {
    mockGetServices.mockResolvedValue(page([LOCATED]));
    const { getByTestId, queryByTestId } = await renderCatalog(<CatalogScreen />);

    await waitFor(() => expect(getByTestId("catalog-list")).toBeTruthy());

    await fireEvent.press(getByTestId("catalog-view-map"));
    expect(getByTestId("services-map")).toBeTruthy();
    expect(queryByTestId("catalog-list")).toBeNull();

    await fireEvent.press(getByTestId("catalog-view-list"));
    expect(getByTestId("catalog-list")).toBeTruthy();
    expect(queryByTestId("services-map")).toBeNull();
  });

  test("tapping a marker surfaces that service's card", async () => {
    mockGetServices.mockResolvedValue(page([LOCATED]));
    const { getByTestId, queryByTestId } = await renderCatalog(<CatalogScreen />);

    await waitFor(() => expect(getByTestId("catalog-list")).toBeTruthy());
    await fireEvent.press(getByTestId("catalog-view-map"));

    // Nothing selected yet: the map prompts instead of showing a stale card.
    expect(queryByTestId("catalog-map-selection")).toBeNull();

    await fireEvent.press(getByTestId("services-map-marker-svc-geo"));

    const selection = getByTestId("catalog-map-selection");
    expect(selection).toBeTruthy();
    // The same card component the list renders — one selection, two views.
    expect(getByTestId("service-card-svc-geo")).toBeTruthy();
  });

  test("shows how far away a service is when the API measured it", async () => {
    mockGetServices.mockResolvedValue(
      page([{ ...LOCATED, distanceKm: 2.34 }]),
    );
    const { getByText } = await renderCatalog(<CatalogScreen />);

    await waitFor(() => expect(getByText(/2\.3 km/)).toBeTruthy());
  });

  test("omits the distance when there was no centre to measure from", async () => {
    mockGetServices.mockResolvedValue(page([LOCATED]));
    const { getByText, queryByText, getByTestId } = await renderCatalog(
      <CatalogScreen />,
    );

    await waitFor(() => expect(getByTestId("catalog-list")).toBeTruthy());
    // The provider line stands alone: an absent distance must read as
    // "unknown", never as "0 m away".
    expect(getByText("CleanPro")).toBeTruthy();
    expect(queryByText(/CleanPro · a /)).toBeNull();
  });
});
