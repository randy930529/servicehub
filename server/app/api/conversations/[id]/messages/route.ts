import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { parsePagination } from "@/app/lib/helpers";
import { listMessages } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/conversations/{id}/messages:
 *   get:
 *     summary: A conversation's history
 *     description: >
 *       **Newest first**, so page 1 is what the chat opens on. Each message
 *       carries `readByPeer`, derived from the other person's read mark rather
 *       than stored per message. A caller who is not in the conversation gets
 *       404, the same as one that does not exist.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Messages, newest first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ChatMessage' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { description: Missing or invalid access token. }
 *       404: { description: Not found, or not your conversation. }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const result = await listMessages(
      id,
      auth.user.id,
      parsePagination({
        page: searchParams.get("page"),
        limit: searchParams.get("limit"),
      }),
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({ data: result.data, meta: result.meta });
  } catch (error) {
    console.error("GET /api/conversations/[id]/messages failed", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
