import { NextResponse } from "next/server";

import { DEFAULT_AVAILABILITY_DAYS } from "@/app/lib/helpers";
import { getServiceAvailability } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/services/{id}/availability:
 *   get:
 *     summary: Free slots for a service
 *     description: >
 *       The provider's working hours minus the hours already booked, from now
 *       to `days` ahead. Computed per request, never cached: a stored
 *       availability table is wrong the instant somebody books. Public, like
 *       the catalog — you can see when a service is free before signing up.
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 14
 *           maximum: 60
 *     responses:
 *       200:
 *         description: Free slots, soonest first, as ISO 8601 instants.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: date-time
 *       404:
 *         description: Service not found.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requested = Number(searchParams.get("days"));

    const result = await getServiceAvailability(
      id,
      Number.isFinite(requested) && requested > 0
        ? requested
        : DEFAULT_AVAILABILITY_DAYS,
    );

    if (!result) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({
      slots: result.slots.map((slot) => slot.toISOString()),
    });
  } catch (error) {
    console.error("GET /api/services/[id]/availability failed", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 },
    );
  }
}
