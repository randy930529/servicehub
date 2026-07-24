import { NextResponse } from "next/server";

import { Login } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate with email + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Session opened; returns the token pair.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SessionResponse' }
 *       400: { description: Invalid body. }
 *       401: { description: Wrong email or password (deliberately vague). }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new Login({
      endpoint: "/api/auth/login",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return NextResponse.json({ error: "Failed to log in" }, { status: 500 });
  }
}
