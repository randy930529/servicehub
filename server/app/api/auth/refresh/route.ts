import { NextResponse } from "next/server";

import { Refresh } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new token pair (rotation)
 *     description: >
 *       The presented refresh token is revoked and a new one is issued —
 *       each refresh token works exactly once.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New session token pair.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SessionResponse' }
 *       400: { description: Invalid body. }
 *       401: { description: Unknown, revoked or expired refresh token. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new Refresh({
      endpoint: "/api/auth/refresh",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/auth/refresh failed", error);
    return NextResponse.json({ error: "Failed to refresh" }, { status: 500 });
  }
}
