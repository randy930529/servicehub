import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import { Service } from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import { DeleteService, UpdateService, toPublicService } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Next 16 hands route params in as a promise. */
type RouteContext = { params: Promise<{ id: string }> };

/**
 * @openapi
 * /api/services/{id}:
 *   get:
 *     summary: Get a single service
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The service.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service: { $ref: '#/components/schemas/Service' }
 *       404: { description: No service with that id. }
 *       500: { description: Server error. }
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    // A malformed id is "not found", not a 500 — `findById` throws a CastError.
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await connectToDatabase();
    const service = await Service.findById(id).lean();
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({ service: toPublicService(service) });
  } catch (error) {
    console.error(`GET /api/services/${id} failed`, error);
    return NextResponse.json(
      { error: "Failed to fetch service" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/services/{id}:
 *   patch:
 *     summary: Update a service
 *     description: Partial update — only the fields present in the body change. Owner only.
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/ServiceInput'
 *               - type: object
 *                 minProperties: 1
 *     responses:
 *       200:
 *         description: The updated service.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service: { $ref: '#/components/schemas/Service' }
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       403: { description: The service (or image key) belongs to someone else. }
 *       404: { description: No service with that id. }
 *       500: { description: Server error. }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return await new UpdateService({
      endpoint: `/api/services/${id}`,
      method: "PATCH",
      id,
    }).submit(request);
  } catch (error) {
    console.error(`PATCH /api/services/${id} failed`, error);
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/services/{id}:
 *   delete:
 *     summary: Delete a service
 *     description: Owner only. The stored image is removed with it.
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: boolean, example: true }
 *                 _id: { type: string }
 *       401: { description: Missing, invalid or expired access token. }
 *       403: { description: The service belongs to someone else. }
 *       404: { description: No service with that id. }
 *       500: { description: Server error. }
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return await new DeleteService({
      endpoint: `/api/services/${id}`,
      method: "DELETE",
      id,
    }).submit(request);
  } catch (error) {
    console.error(`DELETE /api/services/${id} failed`, error);
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 },
    );
  }
}
