import { NextResponse } from "next/server";

import { buildMeta, getSkip, parsePagination } from "@/app/lib/helpers";
import { Service } from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";

// Mongoose needs the Node.js runtime (not Edge), and results depend on the
// query string, so the route is always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/services:
 *   get:
 *     summary: List services (paginated)
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: 1-based page number.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Items per page.
 *     responses:
 *       200:
 *         description: A page of services.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Service' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       500:
 *         description: Server error.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parsePagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    await connectToDatabase();

    const [data, total] = await Promise.all([
      Service.find()
        .sort({ createdAt: -1 })
        .skip(getSkip(params))
        .limit(params.limit)
        .lean(),
      Service.countDocuments(),
    ]);

    return NextResponse.json({ data, meta: buildMeta(params, total) });
  } catch (error) {
    console.error("GET /api/services failed", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 },
    );
  }
}
