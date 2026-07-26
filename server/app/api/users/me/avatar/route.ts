import { NextResponse } from "next/server";

import { ConfirmAvatar, DeleteAvatar } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users/me/avatar:
 *   put:
 *     summary: Confirm an uploaded avatar
 *     description: >
 *       Step 2 of 2. The key must sit under the caller's own prefix, and the
 *       object is inspected in storage (existence, type, size) before it
 *       becomes the user's avatar. The previous avatar is then deleted.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key:
 *                 type: string
 *                 description: The `key` returned by the upload-url endpoint.
 *     responses:
 *       200:
 *         description: The profile with its new avatar.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { description: Malformed key, or nothing was uploaded there. }
 *       401: { description: Missing, invalid or expired access token. }
 *       403: { description: The key belongs to another user. }
 *       413: { description: The stored image exceeds the size limit. }
 *       415: { description: The stored image is not a supported type. }
 *       500: { description: Server error. }
 */
export async function PUT(request: Request) {
  try {
    return await new ConfirmAvatar({
      endpoint: "/api/users/me/avatar",
      method: "PUT",
    }).submit(request);
  } catch (error) {
    console.error("PUT /api/users/me/avatar failed", error);
    return NextResponse.json(
      { error: "Failed to save avatar" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/users/me/avatar:
 *   delete:
 *     summary: Remove the authenticated user's avatar
 *     description: Idempotent — removing a missing avatar is still a 200.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The profile, now without an avatar.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function DELETE(request: Request) {
  try {
    return await new DeleteAvatar({
      endpoint: "/api/users/me/avatar",
      method: "DELETE",
    }).submit(request);
  } catch (error) {
    console.error("DELETE /api/users/me/avatar failed", error);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 },
    );
  }
}
