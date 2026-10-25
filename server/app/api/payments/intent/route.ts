import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { createPaymentIntent } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/intent:
 *   post:
 *     summary: Start a payment for a reservation
 *     description: >
 *       Returns Stripe's `client_secret`, which lets the mobile SDK collect a
 *       card and confirm the charge **without the card touching this server**.
 *       The amount comes from the reservation, never from the request body.
 *       Calling it twice for the same booking reuses the existing intent
 *       rather than creating a second one.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reservationId]
 *             properties:
 *               reservationId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout data for the mobile SDK.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret:
 *                   type: string
 *                 publishableKey:
 *                   type: string
 *                 payment:
 *                   $ref: '#/components/schemas/Payment'
 *       401:
 *         description: Missing or invalid access token.
 *       404:
 *         description: Reservation not found, or not yours.
 *       409:
 *         description: Already paid, or the reservation is cancelled.
 *       503:
 *         description: Payments are not configured on this server.
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    let body: { reservationId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.reservationId) {
      return NextResponse.json(
        { error: "reservationId is required" },
        { status: 400 },
      );
    }

    const result = await createPaymentIntent(body.reservationId, auth.user.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({
      clientSecret: result.clientSecret,
      publishableKey: result.publishableKey,
      payment: result.payment,
    });
  } catch (error) {
    console.error("POST /api/payments/intent failed", error);
    return NextResponse.json(
      { error: "Failed to start payment" },
      { status: 500 },
    );
  }
}
