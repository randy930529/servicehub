import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/lib/auth";
import { refundPayment } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/{id}/refund:
 *   post:
 *     summary: Refund a payment (admin only)
 *     description: >
 *       Gives money back, fully or partially. Omit `amountCents` to refund
 *       whatever is left, which is what an operator usually wants and is
 *       safer than making them do arithmetic under pressure.
 *       Idempotent through Stripe: the key includes the amount already
 *       refunded, so a double-click replays the same refund while two genuinely
 *       different partials still get through. A non-admin gets 404 — telling
 *       someone the endpoint exists is an invitation.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amountCents:
 *                 type: integer
 *                 description: Omit for the full remaining amount.
 *     responses:
 *       200: { description: Refund issued. }
 *       404: { description: Not found, or you are not an admin. }
 *       409: { description: Not refundable, or amount exceeds what remains. }
 *       503: { description: Payments are not configured. }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { id } = await params;

    let body: { amountCents?: number } = {};
    try {
      body = await request.json();
    } catch {
      // No body means "refund the rest", which is a valid request.
    }

    const result = await refundPayment(id, body.amountCents);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/payments/[id]/refund failed", error);
    return NextResponse.json({ error: "Refund failed" }, { status: 500 });
  }
}
