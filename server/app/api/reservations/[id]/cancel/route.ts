import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { cancelReservation } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/reservations/{id}/cancel:
 *   post:
 *     summary: Cancel a reservation
 *     description: >
 *       Either side of the booking may cancel. Idempotent by nature: calling
 *       it on an already-cancelled reservation succeeds and returns the same
 *       state, which is what makes it safe to retry from a flaky connection.
 *       Someone not involved in the booking gets 404, not 403 — they should
 *       not learn it exists.
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The cancelled reservation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       401:
 *         description: Missing or invalid access token.
 *       404:
 *         description: Not found, or not yours.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const { id } = await params;
    const result = await cancelReservation(id, auth.user.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({ reservation: result.reservation });
  } catch (error) {
    console.error("POST /api/reservations/[id]/cancel failed", error);
    return NextResponse.json(
      { error: "Failed to cancel reservation" },
      { status: 500 },
    );
  }
}
