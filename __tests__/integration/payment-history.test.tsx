/**
 * Integration: payment history screen → query → use-case → axios, unmocked.
 * MSW plays the backend.
 *
 * The behaviour worth pinning down is the one week 16 introduced: a refund is
 * **not** a payment status. A charge that succeeded and was then refunded is
 * both of those things, and a receipt has to say so.
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
import { render, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";

import { PaymentHistoryScreen } from "@/features/payments/screens/payment-history-screen";
import { apiUrl, server } from "../helpers/msw-server";

const HISTORY_URL = apiUrl("/api/payments/history");

function apiPayment(over: Record<string, unknown> = {}) {
  return {
    _id: "pay_1",
    reservationId: "res_1",
    amountCents: 30000,
    currency: "mxn",
    status: "succeeded",
    lastError: null,
    refundedCents: 0,
    refundState: "none",
    createdAt: "2026-10-20T10:00:00.000Z",
    ...over,
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

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  clients.forEach((c) => c.clear());
  clients.length = 0;
});
afterAll(() => server.close());

describe("historial de pagos", () => {
  test("shows a receipt with its amount and status", async () => {
    server.use(http.get(HISTORY_URL, () => HttpResponse.json({ data: [apiPayment()] })));

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() => expect(screen.getByTestId("payment-card-pay_1")).toBeTruthy());
    expect(screen.getByText("$300 MXN")).toBeTruthy();
    expect(screen.getByText("Pagado")).toBeTruthy();
  });

  test("a refunded payment still reads as paid, and says what came back", async () => {
    // The whole point of keeping refund state off the status axis: the charge
    // did succeed. Overwriting the status would lose that.
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json({
          data: [apiPayment({ refundedCents: 10000, refundState: "partial" })],
        }),
      ),
    );

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() => expect(screen.getByText("Pagado")).toBeTruthy());
    expect(screen.getByTestId("payment-refund-pay_1")).toBeTruthy();
    expect(screen.getByText(/Reembolsado \$100 MXN de \$300 MXN/)).toBeTruthy();
  });

  test("says 'por completo' for a full refund rather than repeating the amount", async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json({
          data: [apiPayment({ refundedCents: 30000, refundState: "full" })],
        }),
      ),
    );

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() =>
      expect(screen.getByText("Reembolsado por completo")).toBeTruthy(),
    );
  });

  test("shows no refund line when nothing came back", async () => {
    server.use(http.get(HISTORY_URL, () => HttpResponse.json({ data: [apiPayment()] })));

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() => expect(screen.getByTestId("payment-card-pay_1")).toBeTruthy());
    expect(screen.queryByTestId("payment-refund-pay_1")).toBeNull();
  });

  test("shows Stripe's decline reason on a failed charge", async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json({
          data: [apiPayment({ status: "failed", lastError: "Your card was declined." })],
        }),
      ),
    );

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() =>
      expect(screen.getByText("Your card was declined.")).toBeTruthy(),
    );
  });

  test("defaults refund fields for payments that predate them", async () => {
    // Older rows have neither field; the mapper must not render NaN.
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json({
          data: [{ ...apiPayment(), refundedCents: undefined, refundState: undefined }],
        }),
      ),
    );

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() => expect(screen.getByTestId("payment-card-pay_1")).toBeTruthy());
    expect(screen.queryByTestId("payment-refund-pay_1")).toBeNull();
  });

  test("explains an empty history instead of a blank screen", async () => {
    server.use(http.get(HISTORY_URL, () => HttpResponse.json({ data: [] })));

    const screen = await renderWithClient(<PaymentHistoryScreen />);

    await waitFor(() => expect(screen.getByTestId("payments-empty")).toBeTruthy());

    // And the list stays mounted underneath it. Rendering the empty state
    // *instead of* the list looks identical and silently removes
    // pull-to-refresh — on a screen a refund can change without the app
    // being touched.
    expect(screen.getByTestId("payments-list")).toBeTruthy();
    expect(screen.getByTestId("payments-list").props.onRefresh).toBeDefined();
  });
});
