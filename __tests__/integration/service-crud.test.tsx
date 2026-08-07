/**
 * Integration ("E2E básico"): publish a service on the form screen, then see it
 * in the catalog.
 *
 * Nothing between the screen and the network is mocked — form → RHF/Zod →
 * use-case → axios → MSW, and the catalog reads back through its own query. The
 * fake backend keeps the created service in memory, so the catalog really
 * returns what the form posted rather than a canned fixture.
 *
 * Every `fireEvent` is awaited: they are async in Testing Library 14, and an
 * un-awaited one leaves React's act scope open, which breaks later renders.
 */
import type { ReactElement } from "react";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";

import { useAuthStore } from "@/features/auth/stores/auth.store";
import { CatalogScreen } from "@/features/services/screens/catalog-screen";
import { ServiceFormScreen } from "@/features/services/screens/service-form-screen";
import { apiUrl, server } from "../helpers/msw-server";

// Picking a photo goes through the system picker and native image processing.
jest.mock("@/features/services/lib/pick-service-image", () => ({
  pickServiceImageFromLibrary: jest.fn(),
}));

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({}),
}));

const SERVICES_URL = apiUrl("/api/services");

// Neutral value: a quoted literal next to a session key would trip secret
// scanners (GitGuardian) on every PR diff.
const STUB_SESSION_ID = "stub-session-id-abc";

const NEW_NAME = "Poda de jardin";
const NEW_DESCRIPTION = "Poda, limpieza y retiro de residuos del jardin.";

type StoredService = {
  _id: string;
  name: string;
  description: string;
  category: string;
  priceFromCents: number;
  rating: number;
  providerName: string;
  imageUrl: string | null;
  ownerId: string;
  location: { lat: number; lng: number } | null;
};

/** In-memory stand-in for the services collection. */
let catalog: StoredService[] = [];
let createdBodies: Record<string, unknown>[] = [];

/**
 * The fake backend: create appends, list filters by `q` and `category` the way
 * the real endpoint does, so the catalog assertions exercise the query params
 * the app actually sends.
 */
function useBackend() {
  server.use(
    http.post(SERVICES_URL, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      createdBodies.push(body);

      const created: StoredService = {
        _id: `svc-${catalog.length + 1}`,
        name: String(body.name),
        description: String(body.description),
        category: String(body.category),
        priceFromCents: Number(body.priceFromCents),
        rating: 0,
        providerName: "Randy",
        imageUrl: body.imageKey
          ? `http://localhost:9000/service-images/${String(body.imageKey)}`
          : null,
        ownerId: "user-1",
        location: (body.location as StoredService["location"]) ?? null,
      };
      catalog.push(created);

      return HttpResponse.json({ service: created }, { status: 201 });
    }),

    http.get(SERVICES_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get("q")?.toLowerCase();
      const category = params.get("category");

      const data = catalog.filter((service) => {
        if (category && service.category !== category) return false;
        if (q && !`${service.name} ${service.description}`.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      });

      return HttpResponse.json({
        data,
        meta: {
          page: 1,
          limit: 20,
          total: data.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }),
  );
}

const clients: QueryClient[] = [];

function renderScreen(ui: ReactElement) {
  // retry: false — the retry *policy* is unit-tested in query-client.test.ts;
  // here backoff would only slow the assertions down.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

type GetByTestId = Awaited<ReturnType<typeof render>>["getByTestId"];

async function fillForm(getByTestId: GetByTestId) {
  await fireEvent.changeText(getByTestId("service-name-input"), NEW_NAME);
  await fireEvent.changeText(
    getByTestId("service-description-input"),
    NEW_DESCRIPTION,
  );
  await fireEvent.changeText(getByTestId("service-price-input"), "450");
  await fireEvent.press(getByTestId("service-category-hogar"));
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(() => {
  catalog = [];
  createdBodies = [];
  mockBack.mockReset();
  // The endpoint is protected, so the app must be carrying a session.
  useAuthStore.setState({ token: STUB_SESSION_ID });
  useBackend();
});

afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ token: null });
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

afterAll(() => server.close());

describe("publishing a service end to end", () => {
  test("the service posted by the form comes back in the catalog", async () => {
    const form = await renderScreen(<ServiceFormScreen />);
    await fillForm(form.getByTestId);
    await fireEvent.press(form.getByTestId("service-submit-button"));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(createdBodies).toHaveLength(1);
    expect(createdBodies[0]).toMatchObject({
      name: NEW_NAME,
      category: "hogar",
      // Typed in pesos, sent in cents.
      priceFromCents: 45000,
    });

    const catalogScreen = await renderScreen(<CatalogScreen />);

    expect(await catalogScreen.findByTestId("catalog-list")).toBeTruthy();
    expect(await catalogScreen.findByText(NEW_NAME)).toBeTruthy();
    expect(catalogScreen.getByText("Desde $450 MXN")).toBeTruthy();
  });

  test("sends the session token on the protected create endpoint", async () => {
    let authorization: string | null = "not-captured";
    server.use(
      http.post(SERVICES_URL, async ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ service: { _id: "svc-1" } }, { status: 201 });
      }),
    );

    const form = await renderScreen(<ServiceFormScreen />);
    await fillForm(form.getByTestId);
    await fireEvent.press(form.getByTestId("service-submit-button"));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(authorization).toBe(`Bearer ${STUB_SESSION_ID}`);
  });

  test("keeps the user on the form and explains a rejected save", async () => {
    server.use(
      http.post(SERVICES_URL, () =>
        HttpResponse.json(
          { type: "VALIDATION_ERROR", message: "Invalid body" },
          { status: 400 },
        ),
      ),
    );

    const form = await renderScreen(<ServiceFormScreen />);
    await fillForm(form.getByTestId);
    await fireEvent.press(form.getByTestId("service-submit-button"));

    expect(await form.findByTestId("service-server-error")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  test("the new service is reachable through search and category filters", async () => {
    const form = await renderScreen(<ServiceFormScreen />);
    await fillForm(form.getByTestId);
    await fireEvent.press(form.getByTestId("service-submit-button"));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const catalogScreen = await renderScreen(<CatalogScreen />);
    expect(await catalogScreen.findByText(NEW_NAME)).toBeTruthy();

    // A search that matches: the service survives the debounce and the filter.
    await fireEvent.changeText(
      catalogScreen.getByTestId("services-search-input"),
      "poda",
    );
    expect(await catalogScreen.findByText(NEW_NAME)).toBeTruthy();

    // A category it does not belong to empties the list.
    await fireEvent.press(catalogScreen.getByTestId("category-chip-belleza"));
    expect(await catalogScreen.findByTestId("catalog-empty")).toBeTruthy();
  });
});
