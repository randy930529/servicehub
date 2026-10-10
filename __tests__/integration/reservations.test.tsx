/**
 * Integration: booking screen → mutation → use-case → axios, unmocked.
 * MSW plays the backend, so the `Idempotency-Key` header is asserted where it
 * actually travels — on the wire — rather than on a mocked function's args.
 *
 * Covers the two acceptance criteria of the week: reservations created and
 * listed, and idempotency verified.
 */
import type { ReactElement } from "react";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";

import { BookingScreen } from "@/features/reservations/screens/booking-screen";
import { MyReservationsScreen } from "@/features/reservations/screens/my-reservations-screen";
import { apiUrl, server } from "../helpers/msw-server";

const RESERVATIONS_URL = apiUrl("/api/reservations");

const SERVICE = {
  id: "665f1b2c9a1b2c3d4e5f6a7b",
  name: "Limpieza de hogar",
  priceFromCents: 45000,
};

const API_RESERVATION = {
  _id: "771a2b3c4d5e6f7a8b9c0d1e",
  service: { id: SERVICE.id, name: SERVICE.name, imageUrl: null },
  customerId: "customer-1",
  providerId: "provider-1",
  scheduledFor: "2099-06-01T18:00:00.000Z",
  status: "pending" as const,
  priceAtBookingCents: 45000,
  cancelledAt: null,
};

const clients: QueryClient[] = [];

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Walks the two steps and books, returning what the server received. */
async function bookFirstSlot(screen: Awaited<ReturnType<typeof render>>) {
  const slot = (await screen.findAllByTestId(/^slot-hour-/))[0];
  await fireEvent.press(slot);
  await fireEvent.press(screen.getByTestId("booking-continue-button"));
  await fireEvent.press(screen.getByTestId("booking-confirm-button"));
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
afterAll(() => server.close());

describe("crear una reserva", () => {
  let requests: { idempotencyKey: string | null; body: unknown }[] = [];

  beforeEach(() => {
    requests = [];
    server.use(
      http.post(RESERVATIONS_URL, async ({ request }) => {
        requests.push({
          idempotencyKey: request.headers.get("Idempotency-Key"),
          body: await request.json(),
        });
        return HttpResponse.json({ reservation: API_RESERVATION }, { status: 201 });
      }),
    );
  });

  test("sends the slot and an idempotency key", async () => {
    const screen = await renderWithClient(<BookingScreen service={SERVICE} />);

    await bookFirstSlot(screen);

    await waitFor(() => expect(requests).toHaveLength(1));

    const [sent] = requests;
    // The key is the whole point: without it the API refuses the request.
    expect(sent.idempotencyKey).toBeTruthy();
    expect(sent.idempotencyKey).toMatch(/^rsv-/);
    expect(sent.body).toMatchObject({ serviceId: SERVICE.id });
    // ISO 8601 with a timezone, so the API never has to guess one.
    expect((sent.body as { scheduledFor: string }).scheduledFor).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  test("shows the slot picker first and the summary only after continuing", async () => {
    const screen = await renderWithClient(<BookingScreen service={SERVICE} />);

    expect(screen.queryByTestId("booking-summary")).toBeNull();

    const slot = (await screen.findAllByTestId(/^slot-hour-/))[0];
    await fireEvent.press(slot);
    await fireEvent.press(screen.getByTestId("booking-continue-button"));

    expect(screen.getByTestId("booking-summary")).toBeTruthy();
  });
});

describe("idempotencia", () => {
  test("reuses the same key when a failed attempt is retried", async () => {
    // The first attempt fails at the network; the user presses again. That is
    // a *retry*, not a second booking, so the key must not change — otherwise
    // the API would have no way to tell them apart and would create two.
    const keys: (string | null)[] = [];
    let attempt = 0;

    server.use(
      http.post(RESERVATIONS_URL, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        attempt += 1;
        if (attempt === 1) return HttpResponse.error();
        return HttpResponse.json({ reservation: API_RESERVATION }, { status: 201 });
      }),
    );

    const screen = await renderWithClient(<BookingScreen service={SERVICE} />);
    await bookFirstSlot(screen);

    await waitFor(() => expect(screen.getByTestId("booking-error")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("booking-confirm-button"));
    await waitFor(() => expect(keys).toHaveLength(2));

    expect(keys[0]).toBe(keys[1]);
  });

  test("takes a fresh key when the user goes back and picks another slot", async () => {
    // A different slot is a different booking. Carrying the old key over would
    // have the API answer with the previous reservation.
    const keys: (string | null)[] = [];

    server.use(
      http.post(RESERVATIONS_URL, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.error();
      }),
    );

    const screen = await renderWithClient(<BookingScreen service={SERVICE} />);
    await bookFirstSlot(screen);
    await waitFor(() => expect(keys).toHaveLength(1));

    await fireEvent.press(screen.getByTestId("booking-back-button"));
    const slots = await screen.findAllByTestId(/^slot-hour-/);
    await fireEvent.press(slots[1]);
    await fireEvent.press(screen.getByTestId("booking-continue-button"));
    await fireEvent.press(screen.getByTestId("booking-confirm-button"));

    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).not.toBe(keys[1]);
  });

  test("treats a 200 replay exactly like a fresh 201", async () => {
    // The API answers a repeated key with 200 and the booking it already made.
    // The app must not care: either way there is one reservation.
    server.use(
      http.post(RESERVATIONS_URL, () =>
        HttpResponse.json({ reservation: API_RESERVATION }, { status: 200 }),
      ),
    );

    const screen = await renderWithClient(<BookingScreen service={SERVICE} />);
    await bookFirstSlot(screen);

    await waitFor(() =>
      expect(screen.queryByTestId("booking-error")).toBeNull(),
    );
  });

  test("surfaces a 409 instead of pretending the booking worked", async () => {
    server.use(
      http.post(RESERVATIONS_URL, () =>
        HttpResponse.json(
          { message: "You cannot book your own service" },
          { status: 409 },
        ),
      ),
    );

    const screen = await renderWithClient(<BookingScreen service={SERVICE} />);
    await bookFirstSlot(screen);

    const error = await screen.findByTestId("booking-error");
    expect(error).toBeTruthy();
  });
});

describe("listar y cancelar", () => {
  test("lists the caller's reservations", async () => {
    server.use(
      http.get(RESERVATIONS_URL, () =>
        HttpResponse.json({ data: [API_RESERVATION] }),
      ),
    );

    const screen = await renderWithClient(<MyReservationsScreen />);

    await waitFor(() =>
      expect(
        screen.getByTestId(`reservation-card-${API_RESERVATION._id}`),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Limpieza de hogar")).toBeTruthy();
  });

  test("cancels one and reflects the new status", async () => {
    let cancelled = false;

    server.use(
      http.get(RESERVATIONS_URL, () =>
        HttpResponse.json({
          data: [
            cancelled
              ? { ...API_RESERVATION, status: "cancelled", cancelledAt: "2026-10-10T00:00:00.000Z" }
              : API_RESERVATION,
          ],
        }),
      ),
      http.post(`${RESERVATIONS_URL}/${API_RESERVATION._id}/cancel`, () => {
        cancelled = true;
        return HttpResponse.json({
          reservation: { ...API_RESERVATION, status: "cancelled" },
        });
      }),
    );

    const screen = await renderWithClient(<MyReservationsScreen />);

    const cancel = await screen.findByTestId(
      `reservation-cancel-${API_RESERVATION._id}`,
    );
    await fireEvent.press(cancel);

    // The row loses its cancel button once the list refetches: a cancelled
    // booking cannot be cancelled again.
    await waitFor(() =>
      expect(
        screen.queryByTestId(`reservation-cancel-${API_RESERVATION._id}`),
      ).toBeNull(),
    );
    expect(screen.getByText("Cancelada")).toBeTruthy();
  });

  test("explains an empty list rather than showing a blank screen", async () => {
    server.use(http.get(RESERVATIONS_URL, () => HttpResponse.json({ data: [] })));

    const screen = await renderWithClient(<MyReservationsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("reservations-empty")).toBeTruthy(),
    );
  });
});
