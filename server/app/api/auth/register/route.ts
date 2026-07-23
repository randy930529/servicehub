import { NextResponse } from "next/server";

import { Register } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Create an account and open a session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6, format: password }
 *     responses:
 *       201:
 *         description: Account created; returns the session token pair.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SessionResponse' }
 *       400: { description: Invalid body. }
 *       409: { description: Email already registered. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new Register({
      endpoint: "/api/auth/register",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/auth/register failed", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
