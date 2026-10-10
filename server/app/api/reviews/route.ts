import { NextResponse } from "next/server";

import { CreateReview, listServiceReviews } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     summary: Review a reservation you had
 *     description: >
 *       A review is anchored to a reservation, not to a service: it must be
 *       yours, it must already have happened, it must not be cancelled, and it
 *       can only be reviewed once. Those structural rules do most of the
 *       anti-fraud work; a per-hour rate limit is the backstop. Creating one
 *       recomputes the service's reputation in the same request.
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reservationId, rating]
 *             properties:
 *               reservationId:
 *                 type: string
 *                 example: 771a2b3c4d5e6f7a8b9c0d1e
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 nullable: true
 *                 minLength: 3
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Review created, with the service's new reputation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 review:
 *                   $ref: '#/components/schemas/Review'
 *                 reputation:
 *                   $ref: '#/components/schemas/Reputation'
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Missing or invalid access token.
 *       404:
 *         description: Reservation not found, or not yours.
 *       409:
 *         description: Cancelled, not yet happened, or already reviewed.
 *       429:
 *         description: Too many reviews in the last hour.
 */
export async function POST(request: Request) {
  const handler = new CreateReview({
    endpoint: "/api/reviews",
    method: "POST",
  });

  return handler.submit(request);
}

/**
 * @openapi
 * /api/reviews:
 *   get:
 *     summary: List a service's reviews
 *     description: >
 *       Public, like the catalog it belongs to — reviews only logged-in users
 *       can read are reviews nobody reads before deciding to sign up. Capped
 *       at the 50 newest.
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reviews, newest first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *       400:
 *         description: Missing or malformed serviceId.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");

    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId is required" },
        { status: 400 },
      );
    }

    const data = await listServiceReviews(serviceId);

    // `null` means the id could never match anything; answering 400 says so
    // instead of pretending the service exists and has no reviews.
    if (data === null) {
      return NextResponse.json({ error: "Invalid serviceId" }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/reviews failed", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}
