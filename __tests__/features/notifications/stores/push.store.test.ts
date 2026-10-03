import { beforeEach, describe, expect, jest, test } from "@jest/globals";

import { registerDevice, unregisterDevice } from "@/features/notifications/domain/use-cases";
import {
  currentDeviceName,
  currentPlatform,
  getExpoPushToken,
} from "@/features/notifications/lib/push-token";
import { usePushStore } from "@/features/notifications/stores/push.store";

jest.mock("@/features/notifications/domain/use-cases", () => ({
  registerDevice: jest.fn(),
  unregisterDevice: jest.fn(),
  sendTestNotification: jest.fn(),
}));

// Getting a token touches permissions, OS channels and Expo's servers.
jest.mock("@/features/notifications/lib/push-token", () => ({
  getExpoPushToken: jest.fn(),
  currentPlatform: jest.fn(() => "android"),
  currentDeviceName: jest.fn(() => "Pixel 7"),
}));

const mockGetToken = getExpoPushToken as jest.MockedFunction<
  typeof getExpoPushToken
>;
const mockRegister = registerDevice as jest.MockedFunction<typeof registerDevice>;
const mockUnregister = unregisterDevice as jest.MockedFunction<
  typeof unregisterDevice
>;

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

const REGISTERED_DEVICE = {
  token: TOKEN,
  platform: "android" as const,
  deviceName: "Pixel 7",
  lastSeenAt: "2026-08-07T00:00:00.000Z",
};

beforeEach(() => {
  mockGetToken.mockReset();
  mockRegister.mockReset();
  mockUnregister.mockReset();
  (currentPlatform as jest.Mock).mockReturnValue("android");
  (currentDeviceName as jest.Mock).mockReturnValue("Pixel 7");
  usePushStore.setState({ status: "idle", token: null, reason: null });
});

describe("register", () => {
  test("stores the token and marks the device registered", async () => {
    mockGetToken.mockResolvedValue({ status: "granted", token: TOKEN });
    mockRegister.mockResolvedValue(REGISTERED_DEVICE);

    await usePushStore.getState().register();

    expect(mockRegister).toHaveBeenCalledWith({
      token: TOKEN,
      platform: "android",
      deviceName: "Pixel 7",
    });
    expect(usePushStore.getState().status).toBe("registered");
    expect(usePushStore.getState().token).toBe(TOKEN);
    expect(usePushStore.getState().reason).toBeNull();
  });

  test("never registers twice", async () => {
    mockGetToken.mockResolvedValue({ status: "granted", token: TOKEN });
    mockRegister.mockResolvedValue(REGISTERED_DEVICE);

    await usePushStore.getState().register();
    await usePushStore.getState().register();

    // The second call would only bump `lastSeenAt` and race the first.
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  test("explains a denied permission without calling the API", async () => {
    mockGetToken.mockResolvedValue({ status: "denied" });

    await usePushStore.getState().register();

    expect(usePushStore.getState().status).toBe("denied");
    expect(usePushStore.getState().reason).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test("passes through the reason an environment can't do push", async () => {
    // Expo Go on Android, a simulator without Play services, no projectId:
    // all "impossible here", none of them a failure to debug.
    mockGetToken.mockResolvedValue({
      status: "unsupported",
      reason: "Necesitas un development build.",
    });

    await usePushStore.getState().register();

    expect(usePushStore.getState().status).toBe("unsupported");
    expect(usePushStore.getState().reason).toBe(
      "Necesitas un development build.",
    );
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test("reports a broken token lookup", async () => {
    mockGetToken.mockResolvedValue({ status: "failed", error: new Error("x") });

    await usePushStore.getState().register();

    expect(usePushStore.getState().status).toBe("failed");
    expect(usePushStore.getState().token).toBeNull();
  });

  test("keeps the token when the API rejects it, so a retry is cheap", async () => {
    mockGetToken.mockResolvedValue({ status: "granted", token: TOKEN });
    mockRegister.mockRejectedValue(new Error("500"));

    await usePushStore.getState().register();

    expect(usePushStore.getState().status).toBe("failed");
    // Held on to: retrying skips the permission round-trip.
    expect(usePushStore.getState().token).toBe(TOKEN);
    expect(usePushStore.getState().reason).toBeTruthy();
  });

  test("allows a retry after a failure", async () => {
    mockGetToken.mockResolvedValueOnce({ status: "denied" });
    mockGetToken.mockResolvedValueOnce({ status: "granted", token: TOKEN });
    mockRegister.mockResolvedValue(REGISTERED_DEVICE);

    await usePushStore.getState().register();
    await usePushStore.getState().register();

    expect(usePushStore.getState().status).toBe("registered");
    expect(mockGetToken).toHaveBeenCalledTimes(2);
  });
});

describe("unregister", () => {
  test("clears local state and tells the API", async () => {
    mockUnregister.mockResolvedValue(true);
    usePushStore.setState({ status: "registered", token: TOKEN, reason: null });

    await usePushStore.getState().unregister();

    expect(usePushStore.getState().status).toBe("idle");
    expect(usePushStore.getState().token).toBeNull();
    expect(mockUnregister).toHaveBeenCalledWith(TOKEN);
  });

  test("signs out locally even if the API call fails", async () => {
    mockUnregister.mockRejectedValue(new Error("offline"));
    usePushStore.setState({ status: "registered", token: TOKEN, reason: null });

    await usePushStore.getState().unregister();

    expect(usePushStore.getState().status).toBe("idle");
    expect(usePushStore.getState().token).toBeNull();
  });

  test("does nothing to the API when there was no token", async () => {
    await usePushStore.getState().unregister();

    expect(mockUnregister).not.toHaveBeenCalled();
    expect(usePushStore.getState().status).toBe("idle");
  });
});
