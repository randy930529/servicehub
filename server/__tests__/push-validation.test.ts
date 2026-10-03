import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NotificationUrlSchema,
  RegisterDeviceSchema,
  SendTestNotificationSchema,
  UnregisterDeviceSchema,
  isExpoPushToken,
} from "../app/lib/validation/notifications";

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

describe("isExpoPushToken", () => {
  it("accepts both forms Expo issues", () => {
    assert.ok(isExpoPushToken(TOKEN));
    assert.ok(isExpoPushToken("ExpoPushToken[yyyyyyyyyyyyyyyyyyyyyy]"));
  });

  it("rejects a raw FCM/APNs token", () => {
    // A device token from Google or Apple is not what the Expo Push Service
    // accepts; storing one would fail on every send, forever.
    assert.equal(isExpoPushToken("fcm-device-token-abc123"), false);
  });

  it("rejects malformed brackets and empty payloads", () => {
    assert.equal(isExpoPushToken("ExponentPushToken["), false);
    assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
    assert.equal(isExpoPushToken("ExponentPushToken"), false);
    assert.equal(isExpoPushToken(""), false);
  });

  it("rejects a token with something appended", () => {
    assert.equal(isExpoPushToken(`${TOKEN} extra`), false);
    assert.equal(isExpoPushToken(`prefix${TOKEN}`), false);
  });
});

describe("RegisterDeviceSchema", () => {
  it("accepts a valid registration", () => {
    const result = RegisterDeviceSchema.safeParse({
      token: TOKEN,
      platform: "android",
      deviceName: "Pixel 7",
    });
    assert.ok(result.success);
  });

  it("accepts a registration without a device name", () => {
    assert.ok(
      RegisterDeviceSchema.safeParse({ token: TOKEN, platform: "ios" }).success,
    );
    assert.ok(
      RegisterDeviceSchema.safeParse({
        token: TOKEN,
        platform: "ios",
        deviceName: null,
      }).success,
    );
  });

  it("rejects an unknown platform", () => {
    assert.equal(
      RegisterDeviceSchema.safeParse({ token: TOKEN, platform: "windows" })
        .success,
      false,
    );
  });

  it("rejects a token that isn't an Expo push token", () => {
    assert.equal(
      RegisterDeviceSchema.safeParse({ token: "nope", platform: "android" })
        .success,
      false,
    );
  });
});

describe("UnregisterDeviceSchema", () => {
  it("needs a well-formed token", () => {
    assert.ok(UnregisterDeviceSchema.safeParse({ token: TOKEN }).success);
    assert.equal(UnregisterDeviceSchema.safeParse({}).success, false);
    assert.equal(
      UnregisterDeviceSchema.safeParse({ token: "nope" }).success,
      false,
    );
  });
});

describe("NotificationUrlSchema", () => {
  it("accepts in-app paths, with or without a query string", () => {
    assert.ok(NotificationUrlSchema.safeParse("/my-services").success);
    assert.ok(NotificationUrlSchema.safeParse("/service-form?id=abc").success);
  });

  it("refuses to send the user out of the app", () => {
    // A notification that can carry an absolute URL is a redirect primitive.
    for (const url of [
      "https://evil.example",
      "//evil.example",
      "servicehub://deep",
      "my-services",
    ]) {
      assert.equal(NotificationUrlSchema.safeParse(url).success, false, url);
    }
  });
});

describe("SendTestNotificationSchema", () => {
  it("accepts an empty body — everything has a default", () => {
    assert.ok(SendTestNotificationSchema.safeParse({}).success);
  });

  it("accepts a custom title, body and target", () => {
    assert.ok(
      SendTestNotificationSchema.safeParse({
        title: "Hola",
        body: "Tienes una reserva nueva",
        url: "/my-services",
      }).success,
    );
  });

  it("rejects an empty title and an over-long body", () => {
    assert.equal(
      SendTestNotificationSchema.safeParse({ title: "   " }).success,
      false,
    );
    assert.equal(
      SendTestNotificationSchema.safeParse({ body: "a".repeat(241) }).success,
      false,
    );
  });

  it("rejects an absolute URL", () => {
    assert.equal(
      SendTestNotificationSchema.safeParse({ url: "https://evil.example" })
        .success,
      false,
    );
  });
});
