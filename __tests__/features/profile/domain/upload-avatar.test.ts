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
import { HttpResponse, http } from "msw";

import { uploadAvatar } from "@/features/profile/domain/use-cases/upload-avatar";
import { ApiError } from "@/shared/lib/api-error";
import {
  putFileToSignedUrl,
  readFileForUpload,
} from "@/shared/lib/file-upload";
import { apiUrl, server } from "../../../helpers/msw-server";

// The real helpers touch expo-file-system / expo-fetch, which need a device.
jest.mock("@/shared/lib/file-upload", () => ({
  readFileForUpload: jest.fn(),
  putFileToSignedUrl: jest.fn(),
}));

const mockReadFile = readFileForUpload as jest.MockedFunction<
  typeof readFileForUpload
>;
const mockPutFile = putFileToSignedUrl as jest.MockedFunction<
  typeof putFileToSignedUrl
>;

const UPLOAD_URL_ENDPOINT = apiUrl("/api/users/me/avatar/upload-url");
const CONFIRM_ENDPOINT = apiUrl("/api/users/me/avatar");

const IMAGE = { uri: "file:///tmp/avatar.jpg", contentType: "image/jpeg" };
const FILE_SIZE = 184320;
const PAYLOAD = { body: {} as Blob, size: FILE_SIZE };

const SIGNED_URL = "http://localhost:9000/avatars/user-1/a1b2.jpg?X-Amz-Sig=x";
const KEY = "user-1/a1b2.jpg";

const API_PROFILE = {
  user: {
    _id: "user-1",
    name: "Ana Pérez",
    email: "ana@test.com",
    bio: "Electricista",
    phone: "+52 33 1234 5678",
    avatarUrl: "http://localhost:9000/avatars/user-1/a1b2.jpg",
  },
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  mockReadFile.mockReset();
  mockPutFile.mockReset();
  mockReadFile.mockResolvedValue(PAYLOAD);
  mockPutFile.mockResolvedValue(undefined);
});

/** Happy-path handlers; individual tests override what they need. */
function stubUploadFlow() {
  server.use(
    http.post(UPLOAD_URL_ENDPOINT, () =>
      HttpResponse.json({
        uploadUrl: SIGNED_URL,
        key: KEY,
        expiresIn: 300,
        maxBytes: 5 * 1024 * 1024,
      }),
    ),
    http.put(CONFIRM_ENDPOINT, () => HttpResponse.json(API_PROFILE)),
  );
}

describe("uploadAvatar", () => {
  test("runs the three steps in order and maps the profile", async () => {
    const calls: string[] = [];
    server.use(
      http.post(UPLOAD_URL_ENDPOINT, () => {
        calls.push("presign");
        return HttpResponse.json({
          uploadUrl: SIGNED_URL,
          key: KEY,
          expiresIn: 300,
          maxBytes: 5 * 1024 * 1024,
        });
      }),
      http.put(CONFIRM_ENDPOINT, () => {
        calls.push("confirm");
        return HttpResponse.json(API_PROFILE);
      }),
    );
    mockPutFile.mockImplementation(async () => {
      calls.push("upload");
    });

    const profile = await uploadAvatar(IMAGE);

    expect(calls).toEqual(["presign", "upload", "confirm"]);
    expect(profile).toEqual({
      id: "user-1",
      name: "Ana Pérez",
      email: "ana@test.com",
      bio: "Electricista",
      phone: "+52 33 1234 5678",
      avatarUrl: "http://localhost:9000/avatars/user-1/a1b2.jpg",
  workingHours: { startHour: 9, endHour: 18, weekdays: [1, 2, 3, 4, 5, 6] },
    });
  });

  test("declares the measured size and content type when asking for the URL", async () => {
    let requestBody: unknown;
    server.use(
      http.post(UPLOAD_URL_ENDPOINT, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          uploadUrl: SIGNED_URL,
          key: KEY,
          expiresIn: 300,
          maxBytes: 5 * 1024 * 1024,
        });
      }),
      http.put(CONFIRM_ENDPOINT, () => HttpResponse.json(API_PROFILE)),
    );

    await uploadAvatar(IMAGE);

    expect(requestBody).toEqual({
      contentType: "image/jpeg",
      size: FILE_SIZE,
    });
  });

  test("PUTs the bytes to the presigned URL, not to our API", async () => {
    stubUploadFlow();

    await uploadAvatar(IMAGE);

    expect(mockPutFile).toHaveBeenCalledWith(SIGNED_URL, PAYLOAD, "image/jpeg");
  });

  test("confirms with the key the API handed back", async () => {
    let confirmBody: unknown;
    server.use(
      http.post(UPLOAD_URL_ENDPOINT, () =>
        HttpResponse.json({
          uploadUrl: SIGNED_URL,
          key: KEY,
          expiresIn: 300,
          maxBytes: 5 * 1024 * 1024,
        }),
      ),
      http.put(CONFIRM_ENDPOINT, async ({ request }) => {
        confirmBody = await request.json();
        return HttpResponse.json(API_PROFILE);
      }),
    );

    await uploadAvatar(IMAGE);

    expect(confirmBody).toEqual({ key: KEY });
  });

  test("never uploads when the API rejects the image up front", async () => {
    server.use(
      http.post(UPLOAD_URL_ENDPOINT, () =>
        HttpResponse.json(
          { type: "VALIDATION_ERROR", message: "Image is too large" },
          { status: 400 },
        ),
      ),
    );

    await expect(uploadAvatar(IMAGE)).rejects.toBeInstanceOf(ApiError);
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  test("does not confirm when the upload to storage fails", async () => {
    let confirmed = false;
    server.use(
      http.post(UPLOAD_URL_ENDPOINT, () =>
        HttpResponse.json({
          uploadUrl: SIGNED_URL,
          key: KEY,
          expiresIn: 300,
          maxBytes: 5 * 1024 * 1024,
        }),
      ),
      http.put(CONFIRM_ENDPOINT, () => {
        confirmed = true;
        return HttpResponse.json(API_PROFILE);
      }),
    );
    mockPutFile.mockRejectedValue(new Error("storage unreachable"));

    await expect(uploadAvatar(IMAGE)).rejects.toThrow("storage unreachable");
    expect(confirmed).toBe(false);
  });

  test("surfaces a rejected confirmation as an ApiError", async () => {
    server.use(
      http.post(UPLOAD_URL_ENDPOINT, () =>
        HttpResponse.json({
          uploadUrl: SIGNED_URL,
          key: KEY,
          expiresIn: 300,
          maxBytes: 5 * 1024 * 1024,
        }),
      ),
      http.put(CONFIRM_ENDPOINT, () =>
        HttpResponse.json(
          { type: "VALIDATION_ERROR", message: "Key does not belong to you" },
          { status: 403 },
        ),
      ),
    );

    await expect(uploadAvatar(IMAGE)).rejects.toMatchObject({
      kind: "client",
      status: 403,
    });
  });
});
