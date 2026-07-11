/**
 * Integration: catalog screen → query hook → use-case → axios, unmocked.
 * MSW intercepts at the network level and plays the backend
 * (`GET /api/services`), covering success, server/network errors, retry and
 * the auth header skeleton.
 */
import type { ReactElement } from "react";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";

import { useAuthStore } from "@/features/auth/stores/auth.store";
import { CatalogScreen } from "@/features/services/screens/catalog-screen";
import { apiUrl, server } from "../helpers/msw-server";

const SERVICES_URL = apiUrl("/api/services");

// Neutral name/value: a quoted literal next to a session key would trip
// secret scanners (GitGuardian) on every PR diff.
const STUB_SESSION_ID = "stub-session-id-abc";

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

const OK_BODY = {
  data: [API_SERVICE],
  meta: {
    page: 1,
    limit: 100,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

const clients: QueryClient[] = [];

function renderCatalog(ui: ReactElement) {
  // retry: false — the retry *policy* is unit-tested in query-client.test.ts;
  // here backoff would only slow the error-path assertions down.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ token: null });
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

afterAll(() => server.close());

describe("catalog ↔ API integration", () => {
  test("renders the services returned by the API", async () => {
    server.use(http.get(SERVICES_URL, () => HttpResponse.json(OK_BODY)));

    const { findByTestId, getByText } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-list")).toBeTruthy();
    expect(await findByTestId(`service-card-${API_SERVICE._id}`)).toBeTruthy();
    expect(getByText("Limpieza de hogar")).toBeTruthy();
  });

  test("shows the server-error hint on a 500", async () => {
    server.use(
      http.get(SERVICES_URL, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );

    const { findByTestId, getByText } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-error")).toBeTruthy();
    expect(
      getByText(
        "Estamos teniendo problemas con el servidor. Inténtalo más tarde.",
      ),
    ).toBeTruthy();
  });

  test("shows the connection hint when the network fails", async () => {
    server.use(http.get(SERVICES_URL, () => HttpResponse.error()));

    const { findByTestId, getByText } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-error")).toBeTruthy();
    expect(getByText("Revisa tu conexión e inténtalo de nuevo.")).toBeTruthy();
  });

  test("recovers after pressing retry when the API comes back", async () => {
    let calls = 0;
    server.use(
      http.get(SERVICES_URL, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: "boom" }, { status: 500 });
        }
        return HttpResponse.json(OK_BODY);
      }),
    );

    const { findByTestId, getByTestId } = await renderCatalog(
      <CatalogScreen />,
    );

    expect(await findByTestId("catalog-error")).toBeTruthy();

    fireEvent.press(getByTestId("catalog-retry-button"));

    expect(await findByTestId("catalog-list")).toBeTruthy();
    expect(calls).toBe(2);
  });

  test("attaches the session token as a Bearer header", async () => {
    let authorization: string | null = "not-captured";
    server.use(
      http.get(SERVICES_URL, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json(OK_BODY);
      }),
    );

    useAuthStore.setState({ token: STUB_SESSION_ID });
    const { findByTestId } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-list")).toBeTruthy();
    await waitFor(() => expect(authorization).toBe(`Bearer ${STUB_SESSION_ID}`));
  });

  test("sends no auth header without a session", async () => {
    let authorization: string | null = "not-captured";
    server.use(
      http.get(SERVICES_URL, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json(OK_BODY);
      }),
    );

    const { findByTestId } = await renderCatalog(<CatalogScreen />);

    expect(await findByTestId("catalog-list")).toBeTruthy();
    await waitFor(() => expect(authorization).toBeNull());
  });
});
