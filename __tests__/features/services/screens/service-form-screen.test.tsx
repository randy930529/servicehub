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
import {
  createService,
  getService,
  updateService,
  uploadServiceImage,
} from "@/features/services/domain/use-cases";
import { pickServiceImageFromLibrary } from "@/features/services/lib/pick-service-image";
import { ServiceFormScreen } from "@/features/services/screens/service-form-screen";

jest.mock("@/features/services/domain/use-cases", () => ({
  createService: jest.fn(),
  updateService: jest.fn(),
  deleteService: jest.fn(),
  getService: jest.fn(),
  uploadServiceImage: jest.fn(),
}));

jest.mock("@/features/services/lib/pick-service-image", () => ({
  pickServiceImageFromLibrary: jest.fn(),
}));

// `mock`-prefixed so Jest allows the factories below to close over them:
// jest.mock calls are hoisted above every other statement in the file.
const mockRouteParams: { id?: string } = {};
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockRouteParams,
}));

const mockCreate = createService as jest.MockedFunction<typeof createService>;
const mockUpdate = updateService as jest.MockedFunction<typeof updateService>;
const mockGetService = getService as jest.MockedFunction<typeof getService>;
const mockUploadImage = uploadServiceImage as jest.MockedFunction<
  typeof uploadServiceImage
>;
const mockPickImage = pickServiceImageFromLibrary as jest.MockedFunction<
  typeof pickServiceImageFromLibrary
>;

const SERVICE: Service = {
  id: "svc-1",
  name: "Limpieza de hogar",
  description: "Limpieza profunda de casa o departamento, por horas.",
  category: "hogar",
  priceFromCents: 45000,
  rating: 4.8,
  ratingAverage: 4.8,
  reviewCount: 3,
  providerName: "CleanPro",
  imageUrl: "http://localhost:9000/service-images/user-1/a.jpg",
  ownerId: "user-1",
  location: null,
};

const NEW_NAME = "Poda de jardin";
const NEW_DESCRIPTION = "Poda, limpieza y retiro de residuos del jardin.";

const clients: QueryClient[] = [];

function renderForm(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

/**
 * Every `fireEvent` call is awaited: in Testing Library 14 they are async, and
 * an un-awaited one leaves React's act scope open — after two of those, every
 * later render in the file silently commits nothing.
 */

/** Fills every required field with something valid. */
type GetByTestId = Awaited<ReturnType<typeof render>>["getByTestId"];

async function fillValidForm(getByTestId: GetByTestId) {
  await fireEvent.changeText(getByTestId("service-name-input"), NEW_NAME);
  await fireEvent.changeText(getByTestId("service-description-input"), NEW_DESCRIPTION);
  await fireEvent.changeText(getByTestId("service-price-input"), "450");
  await fireEvent.press(getByTestId("service-category-hogar"));
}

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockGetService.mockReset();
  mockUploadImage.mockReset();
  mockPickImage.mockReset();
  mockBack.mockReset();
  delete mockRouteParams.id;
});

afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("ServiceFormScreen - creating", () => {
  test("blocks the submit and shows field errors when the form is empty", async () => {
    const { getByTestId, findByText } = await renderForm(<ServiceFormScreen />);

    await fireEvent.press(getByTestId("service-submit-button"));

    expect(await findByText("Mínimo 3 caracteres")).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("sends the price in cents and navigates back on success", async () => {
    mockCreate.mockResolvedValue({ ...SERVICE, id: "new-1" });
    const { getByTestId } = await renderForm(<ServiceFormScreen />);

    await fillValidForm(getByTestId);

    await fireEvent.press(getByTestId("service-submit-button"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({
      name: NEW_NAME,
      description: NEW_DESCRIPTION,
      category: "hogar",
      // 450 pesos, stored as cents.
      priceFromCents: 45000,
      location: null,
      imageKey: null,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  test("uploads a picked image and attaches its key to the service", async () => {
    mockPickImage.mockResolvedValue({
      status: "picked",
      image: { uri: "file:///tmp/photo.jpg", contentType: "image/jpeg" },
    });
    mockUploadImage.mockResolvedValue("user-1/uploaded.jpg");
    mockCreate.mockResolvedValue(SERVICE);

    const { getByTestId, findByTestId } = await renderForm(
      <ServiceFormScreen />,
    );

    await fireEvent.press(getByTestId("service-image-button"));

    // The local file is shown straight away, before the upload finishes.
    expect(await findByTestId("service-image-preview")).toBeTruthy();
    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(1));

    await fillValidForm(getByTestId);
    await fireEvent.press(getByTestId("service-submit-button"));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ imageKey: "user-1/uploaded.jpg" }),
      ),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  test("warns and keeps the form when the upload fails", async () => {
    mockPickImage.mockResolvedValue({
      status: "picked",
      image: { uri: "file:///tmp/photo.jpg", contentType: "image/jpeg" },
    });
    mockUploadImage.mockRejectedValue(new Error("storage down"));

    const { getByTestId, findByTestId } = await renderForm(
      <ServiceFormScreen />,
    );

    await fireEvent.press(getByTestId("service-image-button"));

    expect(await findByTestId("service-image-notice")).toBeTruthy();
  });

  test("explains a denied photo permission instead of failing silently", async () => {
    mockPickImage.mockResolvedValue({ status: "denied" });

    const { getByTestId, findByTestId } = await renderForm(
      <ServiceFormScreen />,
    );

    await fireEvent.press(getByTestId("service-image-button"));

    expect(await findByTestId("service-image-notice")).toBeTruthy();
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  test("surfaces a server error without navigating away", async () => {
    mockCreate.mockRejectedValue(new Error("boom"));
    const { getByTestId, findByTestId } = await renderForm(
      <ServiceFormScreen />,
    );

    await fillValidForm(getByTestId);
    await fireEvent.press(getByTestId("service-submit-button"));

    expect(await findByTestId("service-server-error")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe("ServiceFormScreen - editing", () => {
  beforeEach(() => {
    mockRouteParams.id = "svc-1";
  });

  test("prefills the form from the loaded service", async () => {
    mockGetService.mockResolvedValue(SERVICE);
    const { findByTestId } = await renderForm(<ServiceFormScreen />);

    const nameInput = await findByTestId("service-name-input");
    expect(nameInput.props.value).toBe("Limpieza de hogar");

    const priceInput = await findByTestId("service-price-input");
    // Cents come back as the pesos the user originally typed.
    expect(priceInput.props.value).toBe("450");
  });

  test("patches the service and leaves an untouched photo alone", async () => {
    mockGetService.mockResolvedValue(SERVICE);
    mockUpdate.mockResolvedValue(SERVICE);

    const { findByTestId, getByTestId } = await renderForm(
      <ServiceFormScreen />,
    );

    await fireEvent.changeText(await findByTestId("service-price-input"), "500");
    await fireEvent.press(getByTestId("service-submit-button"));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [id, changes] = mockUpdate.mock.calls[0];
    expect(id).toBe("svc-1");
    expect(changes.priceFromCents).toBe(50000);
    // No `imageKey` at all: sending null would have deleted the photo.
    expect(changes).not.toHaveProperty("imageKey");
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  test("clears the photo when it is removed", async () => {
    mockGetService.mockResolvedValue(SERVICE);
    mockUpdate.mockResolvedValue({ ...SERVICE, imageUrl: null });

    const { findByTestId, getByTestId } = await renderForm(
      <ServiceFormScreen />,
    );

    await fireEvent.press(await findByTestId("service-image-remove-button"));
    await fireEvent.press(getByTestId("service-submit-button"));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1].imageKey).toBeNull();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
