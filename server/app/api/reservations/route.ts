import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { CreateReservation, listReservations } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/reservations:
 *   post:
 *     summary: Book a service
 *     description: >
 *       Creates a reservation for the authenticated user. The
 *       `Idempotency-Key` header is **required**: retrying with the same key
 *       returns the original booking with 200 instead of creating a second
 *       one. Reusing a key for a different service or slot is a 409, because
 *       answering with the first booking would tell the caller they booked
 *       something they did not.
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 8
 *           maxLength: 255
 *           example: 7b1f1d1e-3f1a-4c4e-9f0e-2a2b3c4d5e6f
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serviceId, scheduledFor]
 *             properties:
 *               serviceId:
 *                 type: string
 *                 example: 6a7607b2caec07d0a2ab5383
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 with offset; must be in the future.
 *     responses:
 *       201:
 *         description: Reservation created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       200:
 *         description: Replay of a previous request with the same key.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       400:
 *         description: Missing/invalid idempotency key, or invalid body.
 *       401:
 *         description: Missing or invalid access token.
 *       404:
 *         description: Service not found.
 *       409:
 *         description: >
 *           Own service, a service with no provider, or an idempotency key
 *           reused for a different reservation.
 */
export async function POST(request: Request) {
  const handler = new CreateReservation({
    endpoint: "/api/reservations",
    method: "POST",
  });

  return handler.submit(request);
}

/**
 * @openapi
 * /api/reservations:
 *   get:
 *     summary: List the caller's reservations
 *     description: >
 *       Always scoped to the authenticated user — there is no "all
 *       reservations" query. `role=provider` returns the bookings made *on*
 *       your services instead of the ones you made.
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [customer, provider]
 *           default: customer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled]
 *     responses:
 *       200:
 *         description: Reservations, newest slot first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reservation'
 *       401:
 *         description: Missing or invalid access token.
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const { searchParams } = new URL(request.url);
    const data = await listReservations(auth.user.id, searchParams);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/reservations failed", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 },
    );
  }
}
