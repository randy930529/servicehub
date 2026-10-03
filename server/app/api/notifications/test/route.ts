import { NextResponse } from "next/server";

import { SendTestNotification } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/notifications/test:
 *   post:
 *     summary: Send a test push to the caller's devices
 *     description: >
 *       End-to-end check of the whole chain: token stored, Expo reachable,
 *       push credentials valid and the app's deep link wired. Tokens Expo
 *       reports as `DeviceNotRegistered` are deleted in the same pass.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Every field is optional, but the body itself must be JSON — send `{}` for the defaults.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, maxLength: 80 }
 *               body: { type: string, maxLength: 240 }
 *               url:
 *                 type: string
 *                 description: In-app path to open when tapped, e.g. /my-services.
 *                 example: /my-services
 *     responses:
 *       200:
 *         description: How the send went.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent:
 *                   type: integer
 *                   description: Messages Expo accepted (not yet proof of delivery).
 *                 failed: { type: integer }
 *                 devices: { type: integer }
 *                 removedTokens:
 *                   type: integer
 *                   description: Dead tokens pruned during this send.
 *       400:
 *         description: Validation failed (e.g. an absolute URL).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       409: { description: The user has no registered devices. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new SendTestNotification({
      endpoint: "/api/notifications/test",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/notifications/test failed", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
