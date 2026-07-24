import { NextResponse } from "next/server";

import { Logout } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Revoke a refresh token (close the session on this device)
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
 *       204: { description: Session revoked (also when the token was already invalid). }
 *       400: { description: Invalid body. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new Logout({
      endpoint: "/api/auth/logout",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/auth/logout failed", error);
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
