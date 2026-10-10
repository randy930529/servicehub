import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { confirmReservation } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/reservations/{id}/confirm:
 *   post:
 *     summary: Accept a booking (provider only)
 *     description: >
 *       Closes the client → provider loop: the customer books, the provider
 *       accepts. Idempotent — confirming an already-confirmed reservation
 *       returns the same state, so a retry is safe. Anyone who is not the
 *       provider gets 404, not 403.
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
 *         description: The confirmed reservation.
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
 *         description: Not found, or you are not its provider.
 *       409:
 *         description: Cancelled, or the slot already passed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    const { id } = await params;
    const result = await confirmReservation(id, auth.user.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({ reservation: result.reservation });
  } catch (error) {
    console.error("POST /api/reservations/[id]/confirm failed", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 },
    );
  }
}
