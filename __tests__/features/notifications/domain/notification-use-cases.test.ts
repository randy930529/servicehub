import { beforeEach, describe, expect, jest, test } from "@jest/globals";

import {
  registerDevice,
  sendTestNotification,
  unregisterDevice,
} from "@/features/notifications/domain/use-cases";
import { apiClient } from "@/shared/lib/api-client";

jest.mock("@/shared/lib/api-client", () => ({
  apiClient: { post: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockDelete = apiClient.delete as jest.MockedFunction<
  typeof apiClient.delete
>;

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

const API_DEVICE = {
  token: TOKEN,
  platform: "android" as const,
  deviceName: "Pixel 7",
  lastSeenAt: "2026-08-07T00:00:00.000Z",
};

beforeEach(() => {
  mockPost.mockReset();
  mockDelete.mockReset();
});

describe("registerDevice", () => {
  test("posts the token, platform and device name", async () => {
    mockPost.mockResolvedValue({ data: { device: API_DEVICE } });

    const device = await registerDevice({
      token: TOKEN,
      platform: "android",
      deviceName: "Pixel 7",
    });

    expect(mockPost).toHaveBeenCalledWith("/api/users/me/devices", {
      token: TOKEN,
      platform: "android",
      deviceName: "Pixel 7",
    });
    expect(device).toEqual(API_DEVICE);
  });

  test("sends an explicit null when the device has no name", async () => {
    mockPost.mockResolvedValue({ data: { device: API_DEVICE } });

    await registerDevice({ token: TOKEN, platform: "ios" });

    expect(mockPost).toHaveBeenCalledWith("/api/users/me/devices", {
      token: TOKEN,
      platform: "ios",
      deviceName: null,
    });
  });

  test("propagates errors from the client", async () => {
    mockPost.mockRejectedValue(new Error("401"));

    await expect(
      registerDevice({ token: TOKEN, platform: "android" }),
    ).rejects.toThrow("401");
  });
});

describe("unregisterDevice", () => {
  test("sends the token in the body of the DELETE", async () => {
    mockDelete.mockResolvedValue({ data: { removed: true } });

    await expect(unregisterDevice(TOKEN)).resolves.toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("/api/users/me/devices", {
      data: { token: TOKEN },
    });
  });

  test("reports when there was nothing to remove", async () => {
    mockDelete.mockResolvedValue({ data: { removed: false } });

    await expect(unregisterDevice(TOKEN)).resolves.toBe(false);
  });
});

describe("sendTestNotification", () => {
  const RESULT = { sent: 1, failed: 0, devices: 1, removedTokens: 0 };

  test("always sends a body, because the API validates JSON", async () => {
    mockPost.mockResolvedValue({ data: RESULT });

    await sendTestNotification();

    expect(mockPost).toHaveBeenCalledWith("/api/notifications/test", {});
  });

  test("forwards a custom title, body and deep link", async () => {
    mockPost.mockResolvedValue({ data: RESULT });

    await sendTestNotification({ title: "Hola", url: "/my-services" });

    expect(mockPost).toHaveBeenCalledWith("/api/notifications/test", {
      title: "Hola",
      url: "/my-services",
    });
  });

  test("returns the send report", async () => {
    mockPost.mockResolvedValue({ data: RESULT });

    await expect(sendTestNotification()).resolves.toEqual(RESULT);
  });
});
