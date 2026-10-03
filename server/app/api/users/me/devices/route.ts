import { NextResponse } from "next/server";

import { RegisterDevice, UnregisterDevice } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users/me/devices:
 *   post:
 *     summary: Register this device's push token
 *     description: >
 *       Upsert keyed by the token. Expo returns the same token on every launch,
 *       so re-registering just refreshes it; if another user signs in on the
 *       same device the token moves to them instead of being duplicated.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token:
 *                 type: string
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *               platform:
 *                 type: string
 *                 enum: [ios, android, web]
 *               deviceName:
 *                 type: string
 *                 nullable: true
 *                 example: Pixel 7
 *     responses:
 *       200:
 *         description: The registered device.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 device: { $ref: '#/components/schemas/Device' }
 *       400:
 *         description: Malformed body or not an Expo push token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new RegisterDevice({
      endpoint: "/api/users/me/devices",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/users/me/devices failed", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/users/me/devices:
 *   delete:
 *     summary: Stop notifications for this device
 *     description: >
 *       Scoped to the caller's own tokens, so knowing a token is not enough to
 *       silence someone else's phone. Idempotent.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Whether a registration was actually removed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 removed: { type: boolean }
 *       400:
 *         description: Malformed body or not an Expo push token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function DELETE(request: Request) {
  try {
    return await new UnregisterDevice({
      endpoint: "/api/users/me/devices",
      method: "DELETE",
    }).submit(request);
  } catch (error) {
    console.error("DELETE /api/users/me/devices failed", error);
    return NextResponse.json(
      { error: "Failed to unregister device" },
      { status: 500 },
    );
  }
}
