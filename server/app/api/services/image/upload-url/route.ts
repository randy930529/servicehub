import { NextResponse } from "next/server";

import { CreateServiceImageUploadUrl } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/services/image/upload-url:
 *   post:
 *     summary: Get a presigned URL to upload a service photo
 *     description: >
 *       The app PUTs the image straight to storage with the returned URL — the
 *       bytes never pass through this API — and then sends the `key` back in
 *       `POST /api/services` or `PATCH /api/services/{id}`. The signature in the
 *       URL is the credential, so that PUT must carry no Authorization header.
 *     tags: [Services]
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
 *                 description: Size in bytes; pre-checked against the limit.
 *     responses:
 *       200:
 *         description: Where to upload.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl: { type: string }
 *                 key: { type: string }
 *                 expiresIn: { type: integer, example: 300 }
 *                 maxBytes: { type: integer, example: 5242880 }
 *       400:
 *         description: Unsupported type or oversized image.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new CreateServiceImageUploadUrl({
      endpoint: "/api/services/image/upload-url",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/services/image/upload-url failed", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 },
    );
  }
}
