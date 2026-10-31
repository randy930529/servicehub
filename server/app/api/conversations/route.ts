import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { listConversations, openConversation } from "@/app/lib/services";
import { OpenConversationSchema } from "@/app/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/conversations:
 *   get:
 *     summary: The caller's conversations
 *     description: >
 *       Most recently active first, each already resolved for the caller: who
 *       the other person is, the last message, and whether there is anything
 *       new. Not paginated — a person's chat list is short.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations, most recent first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Conversation' }
 *       401: { description: Missing or invalid access token. }
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    return NextResponse.json({ data: await listConversations(auth.user.id) });
  } catch (error) {
    console.error("GET /api/conversations failed", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/conversations:
 *   post:
 *     summary: Open the conversation with one person
 *     description: >
 *       Find-or-create, so calling it twice is safe: the pair of participants
 *       is a unique key, and the second caller gets the same thread rather
 *       than a second one. 200 when it already existed, 201 on first contact.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [peerId]
 *             properties:
 *               peerId:
 *                 type: string
 *                 example: 6a7607b2caec07d0a2ab5383
 *     responses:
 *       200:
 *         description: The existing conversation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation: { $ref: '#/components/schemas/Conversation' }
 *       201: { description: Conversation created. }
 *       400: { description: Invalid body. }
 *       401: { description: Missing or invalid access token. }
 *       404: { description: No such user. }
 *       409: { description: That user is you. }
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const parsed = OpenConversationSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 },
      );
    }

    const result = await openConversation(auth.user.id, parsed.data.peerId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { conversation: result.conversation },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("POST /api/conversations failed", error);
    return NextResponse.json(
      { error: "Failed to open conversation" },
      { status: 500 },
    );
  }
}
