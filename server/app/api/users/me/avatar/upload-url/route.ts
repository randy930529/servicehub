import { NextResponse } from "next/server";

import { CreateAvatarUploadUrl } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/users/me/avatar/upload-url:
 *   post:
 *     summary: Request a presigned URL to upload an avatar
 *     description: >
 *       Step 1 of 2. The client PUTs the image bytes straight to `uploadUrl`
 *       (with the same `Content-Type`), then confirms the upload with
 *       `PUT /api/users/me/avatar`. The image never passes through this API.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentType, size]
 *             properties:
 *               contentType:
 *                 type: string
 *                 enum: [image/jpeg, image/png, image/webp]
 *               size:
 *                 type: integer
 *                 description: Size in bytes, pre-checked against the limit.
 *                 example: 184320
 *     responses:
 *       200:
 *         description: Presigned upload target.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl: { type: string, description: Presigned PUT URL. }
 *                 key: { type: string, example: 665f1b2c9a1b2c3d4e5f6a7b/a1b2.jpg }
 *                 expiresIn: { type: integer, example: 300 }
 *                 maxBytes: { type: integer, example: 5242880 }
 *       400:
 *         description: Validation failed (bad type or oversized image).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new CreateAvatarUploadUrl({
      endpoint: "/api/users/me/avatar/upload-url",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/users/me/avatar/upload-url failed", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 },
    );
  }
}
