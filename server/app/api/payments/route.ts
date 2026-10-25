import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { getPaymentForReservation } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments:
 *   get:
 *     summary: The caller's payment for a reservation
 *     description: >
 *       How the app learns a payment actually settled. The mobile SDK only
 *       reports that the card was accepted; the webhook is what confirms the
 *       charge cleared, and this reads back the result. Always scoped to the
 *       authenticated customer.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The payment, or null if none was ever started.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payment:
 *                   nullable: true
 *                   $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Missing reservationId.
 *       401:
 *         description: Missing or invalid access token.
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");

    if (!reservationId) {
      return NextResponse.json(
        { error: "reservationId is required" },
        { status: 400 },
      );
    }

    const payment = await getPaymentForReservation(reservationId, auth.user.id);

    return NextResponse.json({ payment });
  } catch (error) {
    console.error("GET /api/payments failed", error);
    return NextResponse.json(
      { error: "Failed to fetch payment" },
      { status: 500 },
    );
  }
}
