/**
 * Integration: checkout screen → mutation/query → use-cases → axios, unmocked.
 * MSW plays our backend; the Stripe SDK is mocked at `lib/stripe-checkout`,
 * which is the seam the feature was built around — the screens never import
 * the SDK, so nothing native has to be faked.
 *
 * The behaviour under test is the one that is easy to get wrong: **closing
 * the sheet is not the same as being paid**. The charge is confirmed by a
 * webhook, and the app only learns about it by asking our API again.
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

import { CheckoutScreen } from "@/features/payments/screens/checkout-screen";
import { runCheckout } from "@/features/payments/lib/stripe-checkout";
import { apiUrl, server } from "../helpers/msw-server";

jest.mock("@/features/payments/lib/stripe-checkout", () => ({
  runCheckout: jest.fn(),
}));

const mockRunCheckout = runCheckout as jest.MockedFunction<typeof runCheckout>;

const INTENT_URL = apiUrl("/api/payments/intent");
const PAYMENTS_URL = apiUrl("/api/payments");

const RESERVATION_ID = "771a2b3c4d5e6f7a8b9c0d1e";

const PROPS = {
  reservationId: RESERVATION_ID,
  serviceName: "Limpieza de hogar",
  amountCents: 45000,
};

function apiPayment(status: string, lastError: string | null = null) {
  return {
    _id: "pay_1",
    reservationId: RESERVATION_ID,
    amountCents: 45000,
    currency: "mxn",
    status,
    lastError,
  };
}

const clients: QueryClient[] = [];

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** The API hands back a secret; what it contains is Stripe's business. */
function intentHandler() {
  return http.post(INTENT_URL, () =>
    HttpResponse.json({
      clientSecret: "pi_test_secret",
      publishableKey: "pk_test_123",
      payment: apiPayment("requires_payment"),
    }),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  mockRunCheckout.mockReset();
  server.use(intentHandler());
});
afterEach(() => {
  server.resetHandlers();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
afterAll(() => server.close());

describe("checkout", () => {
  test("shows the amount before anything is charged", async () => {
    server.use(http.get(PAYMENTS_URL, () => HttpResponse.json({ payment: null })));

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);

    expect(screen.getByText("$450 MXN")).toBeTruthy();
  });

  test("sends only the reservation id — never an amount", async () => {
    // The server reads the price off the booking. An amount the client can
    // send is an amount the client can set to one cent.
    const bodies: unknown[] = [];
    server.use(
      http.post(INTENT_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          clientSecret: "pi_test_secret",
          publishableKey: "pk_test_123",
          payment: apiPayment("requires_payment"),
        });
      }),
      http.get(PAYMENTS_URL, () => HttpResponse.json({ payment: null })),
    );
    mockRunCheckout.mockResolvedValue({ status: "completed" });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ reservationId: RESERVATION_ID });
  });

  test("hands the sheet the secret and key the API returned", async () => {
    server.use(http.get(PAYMENTS_URL, () => HttpResponse.json({ payment: null })));
    mockRunCheckout.mockResolvedValue({ status: "completed" });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() => expect(mockRunCheckout).toHaveBeenCalled());
    expect(mockRunCheckout).toHaveBeenCalledWith({
      clientSecret: "pi_test_secret",
      // Comes from the server, not the bundle, so rotating keys needs no
      // app release.
      publishableKey: "pk_test_123",
    });
  });
});

describe("estados de pago", () => {
  test("does not claim success just because the sheet closed", async () => {
    // The heart of it: Stripe accepted the card, the webhook has not landed.
    // Showing "paid" here would be a lie the user acts on.
    server.use(
      http.get(PAYMENTS_URL, () =>
        HttpResponse.json({ payment: apiPayment("processing") }),
      ),
    );
    mockRunCheckout.mockResolvedValue({ status: "completed" });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() =>
      expect(screen.getByTestId("checkout-status-processing")).toBeTruthy(),
    );
    expect(screen.queryByTestId("checkout-status-succeeded")).toBeNull();
    expect(screen.queryByTestId("checkout-done-button")).toBeNull();
  });

  test("celebrates only once our API says the charge settled", async () => {
    server.use(
      http.get(PAYMENTS_URL, () =>
        HttpResponse.json({ payment: apiPayment("succeeded") }),
      ),
    );
    mockRunCheckout.mockResolvedValue({ status: "completed" });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() =>
      expect(screen.getByTestId("checkout-status-succeeded")).toBeTruthy(),
    );
    expect(screen.getByTestId("checkout-done-button")).toBeTruthy();
  });

  test("shows Stripe's decline reason rather than inventing one", async () => {
    server.use(
      http.get(PAYMENTS_URL, () =>
        HttpResponse.json({
          payment: apiPayment("failed", "Your card has insufficient funds."),
        }),
      ),
    );
    mockRunCheckout.mockResolvedValue({ status: "completed" });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() =>
      expect(
        screen.getByText("Your card has insufficient funds."),
      ).toBeTruthy(),
    );
  });

  test("treats a dismissed sheet as a non-event, not a failure", async () => {
    // Backing out is not an error, and red text would say otherwise.
    server.use(http.get(PAYMENTS_URL, () => HttpResponse.json({ payment: null })));
    mockRunCheckout.mockResolvedValue({ status: "canceled" });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() =>
      expect(screen.getByTestId("checkout-canceled")).toBeTruthy(),
    );
    expect(screen.queryByTestId("checkout-error")).toBeNull();
  });

  test("surfaces a failure from the sheet itself", async () => {
    server.use(http.get(PAYMENTS_URL, () => HttpResponse.json({ payment: null })));
    mockRunCheckout.mockResolvedValue({
      status: "failed",
      message: "Tarjeta rechazada",
    });

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() =>
      expect(screen.getByText("Tarjeta rechazada")).toBeTruthy(),
    );
  });

  test("explains a server that has no payments configured", async () => {
    server.use(
      http.post(INTENT_URL, () =>
        HttpResponse.json({ error: "Payments are not configured" }, { status: 503 }),
      ),
      http.get(PAYMENTS_URL, () => HttpResponse.json({ payment: null })),
    );

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);
    await fireEvent.press(screen.getByTestId("checkout-pay-button"));

    await waitFor(() => expect(screen.getByTestId("checkout-error")).toBeTruthy());
    // The sheet must never open when the API refused to start a payment.
    expect(mockRunCheckout).not.toHaveBeenCalled();
  });

  test("will not retry a payment the server already settled", async () => {
    server.use(
      http.get(PAYMENTS_URL, () =>
        HttpResponse.json({ payment: apiPayment("canceled") }),
      ),
    );

    const screen = await renderWithClient(<CheckoutScreen {...PROPS} />);

    await waitFor(() =>
      expect(screen.getByTestId("checkout-status-canceled")).toBeTruthy(),
    );
    expect(screen.getByTestId("checkout-pay-button").props.accessibilityState)
      .toMatchObject({ disabled: true });
  });
});
