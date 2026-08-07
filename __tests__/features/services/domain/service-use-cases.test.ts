import { beforeEach, describe, expect, jest, test } from "@jest/globals";

import {
  createService,
  deleteService,
  updateService,
} from "@/features/services/domain/use-cases";
import { uploadServiceImage } from "@/features/services/domain/use-cases/upload-service-image";
import { apiClient } from "@/shared/lib/api-client";
import { putFileToSignedUrl, readFileForUpload } from "@/shared/lib/file-upload";

jest.mock("@/shared/lib/api-client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/shared/lib/file-upload", () => ({
  readFileForUpload: jest.fn(),
  putFileToSignedUrl: jest.fn(),
}));

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>;
const mockDelete = apiClient.delete as jest.MockedFunction<
  typeof apiClient.delete
>;
const mockReadFile = readFileForUpload as jest.MockedFunction<
  typeof readFileForUpload
>;
const mockPutFile = putFileToSignedUrl as jest.MockedFunction<
  typeof putFileToSignedUrl
>;

const API_SERVICE = {
  _id: "svc-1",
  name: "Limpieza de hogar",
  description: "Limpieza profunda de tu casa.",
  category: "hogar" as const,
  priceFromCents: 45000,
  rating: 0,
  providerName: "Randy",
  imageUrl: null,
  ownerId: "user-1",
  location: null,
};

const INPUT = {
  name: "Limpieza de hogar",
  description: "Limpieza profunda de tu casa.",
  category: "hogar" as const,
  priceFromCents: 45000,
};

beforeEach(() => {
  mockPost.mockReset();
  mockPatch.mockReset();
  mockDelete.mockReset();
  mockReadFile.mockReset();
  mockPutFile.mockReset();
});

describe("createService", () => {
  test("posts the input and maps the response to the domain shape", async () => {
    mockPost.mockResolvedValue({ data: { service: API_SERVICE } });

    const service = await createService(INPUT);

    expect(mockPost).toHaveBeenCalledWith("/api/services", INPUT);
    expect(service.id).toBe("svc-1");
    expect(service).not.toHaveProperty("_id");
  });

  test("sends an explicit null image key so the API knows there is no photo", async () => {
    mockPost.mockResolvedValue({ data: { service: API_SERVICE } });

    await createService({ ...INPUT, imageKey: null });

    expect(mockPost).toHaveBeenCalledWith("/api/services", {
      ...INPUT,
      imageKey: null,
    });
  });
});

describe("updateService", () => {
  test("patches only the fields that changed", async () => {
    mockPatch.mockResolvedValue({ data: { service: API_SERVICE } });

    await updateService("svc-1", { priceFromCents: 50000 });

    expect(mockPatch).toHaveBeenCalledWith("/api/services/svc-1", {
      priceFromCents: 50000,
    });
  });

  test("omits untouched fields but keeps an explicit null", async () => {
    mockPatch.mockResolvedValue({ data: { service: API_SERVICE } });

    // `undefined` means "leave it alone", `null` means "clear it" — the two
    // must not collapse into the same request body.
    await updateService("svc-1", { imageKey: null, location: undefined });

    expect(mockPatch).toHaveBeenCalledWith("/api/services/svc-1", {
      imageKey: null,
    });
  });

  test("propagates errors from the client", async () => {
    mockPatch.mockRejectedValue(new Error("403"));

    await expect(updateService("svc-1", { name: "x" })).rejects.toThrow("403");
  });
});

describe("deleteService", () => {
  test("deletes and resolves with the id for cache eviction", async () => {
    mockDelete.mockResolvedValue({ data: { deleted: true } });

    await expect(deleteService("svc-1")).resolves.toBe("svc-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/services/svc-1");
  });
});

describe("uploadServiceImage", () => {
  const IMAGE = { uri: "file:///tmp/photo.jpg", contentType: "image/jpeg" };
  // Stand-in for the file handle `readFileForUpload` hands back.
  const BODY = {} as Blob;

  test("asks for a presigned URL, PUTs the bytes and returns the key", async () => {
    mockReadFile.mockResolvedValue({ body: BODY, size: 1234 });
    mockPost.mockResolvedValue({
      data: {
        uploadUrl: "https://storage.example/put",
        key: "user-1/abc.jpg",
        expiresIn: 300,
        maxBytes: 5242880,
      },
    });

    const key = await uploadServiceImage(IMAGE);

    expect(mockPost).toHaveBeenCalledWith("/api/services/image/upload-url", {
      contentType: "image/jpeg",
      size: 1234,
    });
    expect(mockPutFile).toHaveBeenCalledWith(
      "https://storage.example/put",
      { body: BODY, size: 1234 },
      "image/jpeg",
    );
    expect(key).toBe("user-1/abc.jpg");
  });

  test("never uploads when the API refuses to sign", async () => {
    mockReadFile.mockResolvedValue({ body: BODY, size: 99_000_000 });
    mockPost.mockRejectedValue(new Error("413"));

    await expect(uploadServiceImage(IMAGE)).rejects.toThrow("413");
    expect(mockPutFile).not.toHaveBeenCalled();
  });
});
