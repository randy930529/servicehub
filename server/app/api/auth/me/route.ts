import { NextResponse } from "next/server";

import { UserMe } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Current user (requires a valid access token)
 *     description: The reference protected endpoint — proves Bearer JWT auth end-to-end.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The authenticated user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function GET(request: Request) {
  try {
    return await new UserMe({
      endpoint: "/api/auth/me",
      method: "GET",
    }).submit(request);
  } catch (error) {
    console.error("GET /api/auth/me failed", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
