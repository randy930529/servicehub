import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { authenticateRequest, authErrorResponse as authError } from "@/app/lib/auth";
import { ZodSubmitHandler } from "@/app/lib/core";
import { DeviceToken, type DeviceTokenDocument } from "@/app/lib/models";
import {
  buildPushMessage,
  sendExpoPushNotifications,
} from "@/app/lib/notifications";
import {
  RegisterDeviceSchema,
  SendTestNotificationSchema,
  UnregisterDeviceSchema,
  type RegisterDeviceInputType,
  type SendTestNotificationInputType,
  type UnregisterDeviceInputType,
} from "@/app/lib/validation";

const DEFAULT_TEST_TITLE = "ServiceHub";
const DEFAULT_TEST_BODY = "Notificación de prueba. Si la ves, todo funciona.";
const DEFAULT_TEST_URL = "/my-services";

/**
 * `POST /api/users/me/devices` — registers (or refreshes) this device's push
 * token for the caller.
 *
 * Upsert keyed by the token, not by the user: Expo hands the same token back on
 * every launch, and if someone else signs in on that phone the token must
 * *move* to them. Inserting a second row instead would keep pushing the
 * previous user's notifications to a device they no longer use.
 */
export class RegisterDevice extends ZodSubmitHandler<
  RegisterDeviceInputType,
  DeviceTokenDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(DeviceToken, config);
  }

  protected schema(): ZodType<RegisterDeviceInputType> {
    return RegisterDeviceSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);
    const { token, platform, deviceName } = parsed.data;

    const device = await DeviceToken.findOneAndUpdate(
      { token },
      {
        token,
        owner: auth.user._id,
        platform,
        deviceName: deviceName ?? null,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({
      device: {
        token: device.token,
        platform: device.platform,
        deviceName: device.deviceName,
        lastSeenAt: device.lastSeenAt.toISOString(),
      },
    });
  }
}

/**
 * `DELETE /api/users/me/devices` — stops notifications for this device.
 *
 * Scoped to the caller's own tokens, so knowing a token string is not enough to
 * silence someone else's phone. Idempotent: unregistering twice is a success.
 */
export class UnregisterDevice extends ZodSubmitHandler<
  UnregisterDeviceInputType,
  DeviceTokenDocument
> {
  constructor(config: { endpoint: string; method: "DELETE" }) {
    super(DeviceToken, config);
  }

  protected schema(): ZodType<UnregisterDeviceInputType> {
    return UnregisterDeviceSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);

    const result = await DeviceToken.deleteOne({
      token: parsed.data.token,
      owner: auth.user._id,
    });

    return NextResponse.json({ removed: result.deletedCount > 0 });
  }
}

/**
 * `POST /api/notifications/test` — pushes to every device the caller has
 * registered.
 *
 * The end-to-end check for the whole chain: token stored here, Expo reachable,
 * credentials valid, and the app's deep link wired. Dead tokens reported by
 * Expo are deleted in the same pass, so the collection self-heals.
 */
export class SendTestNotification extends ZodSubmitHandler<
  SendTestNotificationInputType,
  DeviceTokenDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(DeviceToken, config);
  }

  protected schema(): ZodType<SendTestNotificationInputType> {
    return SendTestNotificationSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);

    const devices = await DeviceToken.find({ owner: auth.user._id }).lean();
    if (devices.length === 0) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "No devices registered for this user",
        },
        409,
      );
    }

    const messages = devices.map((device) =>
      buildPushMessage({
        token: device.token,
        title: parsed.data.title ?? DEFAULT_TEST_TITLE,
        body: parsed.data.body ?? DEFAULT_TEST_BODY,
        url: parsed.data.url ?? DEFAULT_TEST_URL,
      }),
    );

    const { tickets, unregisteredTokens } =
      await sendExpoPushNotifications(messages);

    if (unregisteredTokens.length > 0) {
      await DeviceToken.deleteMany({ token: { $in: unregisteredTokens } });
    }

    return NextResponse.json({
      sent: tickets.filter((ticket) => ticket.status === "ok").length,
      failed: tickets.filter((ticket) => ticket.status === "error").length,
      devices: devices.length,
      removedTokens: unregisteredTokens.length,
    });
  }
}
