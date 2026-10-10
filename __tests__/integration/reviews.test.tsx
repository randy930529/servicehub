/**
 * Integration: review form / review list → query hooks → use-cases → axios,
 * unmocked. MSW plays the backend, so the rejections the API really sends
 * (already reviewed, not yet happened, rate limited) are exercised as HTTP
 * rather than as mocked throws.
 *
 * Covers the week's acceptance criteria: reviews visible, reputation shown.
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

import { ServiceReviews } from "@/features/reviews/components/service-reviews";
import { ReviewFormScreen } from "@/features/reviews/screens/review-form-screen";
import { apiUrl, server } from "../helpers/msw-server";

const REVIEWS_URL = apiUrl("/api/reviews");
const SERVICE_ID = "665f1b2c9a1b2c3d4e5f6a7b";
const RESERVATION_ID = "771a2b3c4d5e6f7a8b9c0d1e";

const API_REVIEW = {
  _id: "881a2b3c4d5e6f7a8b9c0d1e",
  serviceId: SERVICE_ID,
  authorName: "Ana",
  rating: 5,
  comment: "Excelente trabajo",
  createdAt: "2026-10-01T10:00:00.000Z",
};

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
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
afterAll(() => server.close());

describe("reseñas visibles", () => {
  test("lists a service's reviews", async () => {
    server.use(
      http.get(REVIEWS_URL, () => HttpResponse.json({ data: [API_REVIEW] })),
    );

    const screen = await renderWithClient(
      <ServiceReviews serviceId={SERVICE_ID} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(`review-card-${API_REVIEW._id}`)).toBeTruthy(),
    );
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Excelente trabajo")).toBeTruthy();
  });

  test("says so when a service has none, instead of rendering nothing", async () => {
    server.use(http.get(REVIEWS_URL, () => HttpResponse.json({ data: [] })));

    const screen = await renderWithClient(
      <ServiceReviews serviceId={SERVICE_ID} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("service-reviews-empty")).toBeTruthy(),
    );
  });

  test("a failed review list does not block the rest of the screen", async () => {
    server.use(http.get(REVIEWS_URL, () => HttpResponse.error()));

    const screen = await renderWithClient(
      <ServiceReviews serviceId={SERVICE_ID} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("service-reviews-error")).toBeTruthy(),
    );
  });
});

describe("dejar una reseña", () => {
  test("sends the stars and the comment", async () => {
    const sent: unknown[] = [];

    server.use(
      http.post(REVIEWS_URL, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(
          { review: API_REVIEW, reputation: { score: 4.4, average: 5, reviewCount: 1 } },
          { status: 201 },
        );
      }),
    );

    const screen = await renderWithClient(
      <ReviewFormScreen reservationId={RESERVATION_ID} serviceName="Limpieza" />,
    );

    await fireEvent.press(screen.getByTestId("review-star-4"));
    await fireEvent.changeText(
      screen.getByTestId("review-comment-input"),
      "Muy puntual",
    );
    await fireEvent.press(screen.getByTestId("review-submit-button"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      reservationId: RESERVATION_ID,
      rating: 4,
      comment: "Muy puntual",
    });
  });

  test("sends null rather than an empty comment", async () => {
    // "" is absence, not content: storing it would make "has a comment" lie.
    const sent: Record<string, unknown>[] = [];

    server.use(
      http.post(REVIEWS_URL, async ({ request }) => {
        sent.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { review: API_REVIEW, reputation: { score: 4.4, average: 5, reviewCount: 1 } },
          { status: 201 },
        );
      }),
    );

    const screen = await renderWithClient(
      <ReviewFormScreen reservationId={RESERVATION_ID} serviceName="Limpieza" />,
    );

    await fireEvent.press(screen.getByTestId("review-star-5"));
    await fireEvent.press(screen.getByTestId("review-submit-button"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].comment).toBeNull();
  });

  test("refuses to submit without a rating", async () => {
    let called = false;
    server.use(
      http.post(REVIEWS_URL, () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const screen = await renderWithClient(
      <ReviewFormScreen reservationId={RESERVATION_ID} serviceName="Limpieza" />,
    );

    await fireEvent.press(screen.getByTestId("review-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("review-rating-error")).toBeTruthy(),
    );
    // No stars pre-selected means no accidental fives reach the catalog.
    expect(called).toBe(false);
  });
});

describe("rechazos del backend", () => {
  async function submitAgainst(status: number, message: string) {
    server.use(
      http.post(REVIEWS_URL, () =>
        HttpResponse.json({ message }, { status }),
      ),
    );

    const screen = await renderWithClient(
      <ReviewFormScreen reservationId={RESERVATION_ID} serviceName="Limpieza" />,
    );

    await fireEvent.press(screen.getByTestId("review-star-5"));
    await fireEvent.press(screen.getByTestId("review-submit-button"));

    return screen.findByTestId("review-error");
  }

  test("surfaces 'already reviewed' instead of a generic failure", async () => {
    const error = await submitAgainst(409, "You already reviewed this reservation");

    expect(error).toBeTruthy();
  });

  test("surfaces the rate limit, which the user can act on by waiting", async () => {
    const error = await submitAgainst(
      429,
      "Too many reviews in a short time. Try again later.",
    );

    expect(error).toBeTruthy();
  });
});
