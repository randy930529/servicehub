import { NextResponse } from "next/server";

import { GetProfile, UpdateProfile } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The profile.
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
    return await new GetProfile({
      endpoint: "/api/users/me",
      method: "GET",
    }).submit(request);
  } catch (error) {
    console.error("GET /api/users/me failed", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     description: Partial update — only the fields present in the body change.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 60 }
 *               bio: { type: string, maxLength: 280 }
 *               phone: { type: string, example: "+52 33 1234 5678" }
 *     responses:
 *       200:
 *         description: The updated profile.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function PATCH(request: Request) {
  try {
    return await new UpdateProfile({
      endpoint: "/api/users/me",
      method: "PATCH",
    }).submit(request);
  } catch (error) {
    console.error("PATCH /api/users/me failed", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
