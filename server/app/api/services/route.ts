import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import {
  buildGeoNearStage,
  buildMeta,
  getSkip,
  parsePagination,
  parseServiceFilters,
} from "@/app/lib/helpers";
import { Service } from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import { CreateService, toPublicService } from "@/app/lib/services";

// Mongoose needs the Node.js runtime (not Edge), and results depend on the
// query string, so the route is always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/services:
 *   get:
 *     summary: Search and list services (paginated)
 *     description: >
 *       Full-text search over name/description plus category, price-range and
 *       radius filters. `owner=me` restricts the list to the caller's own
 *       services and requires a bearer token.
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
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Full-text search (Spanish stemming; name outweighs description).
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [hogar, belleza, tecnologia, bienestar, automotriz]
 *       - in: query
 *         name: minPrice
 *         schema: { type: integer, minimum: 0 }
 *         description: Lowest starting price, in MXN cents.
 *       - in: query
 *         name: maxPrice
 *         schema: { type: integer, minimum: 0 }
 *         description: Highest starting price, in MXN cents.
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: Latitude of the search centre (needs lng and radiusKm).
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *         description: Longitude of the search centre (needs lat and radiusKm).
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, minimum: 0, maximum: 500 }
 *         description: Radius in km around the centre. Services without a location are excluded.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [relevance, recent, price_asc, price_desc, rating]
 *         description: Defaults to `relevance` with `q`, `recent` without it.
 *       - in: query
 *         name: owner
 *         schema: { type: string, enum: [me] }
 *         description: Only the authenticated user's services.
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
 *       401: { description: owner=me without a valid access token. }
 *       500: { description: Server error. }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parsePagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const { filter, sort, usesTextScore, center, usesGeoNear } =
      parseServiceFilters({
      q: searchParams.get("q"),
      category: searchParams.get("category"),
      minPrice: searchParams.get("minPrice"),
      maxPrice: searchParams.get("maxPrice"),
      lat: searchParams.get("lat"),
      lng: searchParams.get("lng"),
      radiusKm: searchParams.get("radiusKm"),
      sort: searchParams.get("sort"),
      });

    const query: Record<string, unknown> = { ...filter };

    // "My services" is a filter on the same endpoint rather than a route of its
    // own — same pagination, sorting and search apply to it.
    if (searchParams.get("owner") === "me") {
      const auth = await authenticateRequest(request);
      if (!auth.ok) return authErrorResponse(auth.reason);
      query.owner = auth.user._id;
    }

    await connectToDatabase();

    // Only Mongo can order by distance, and only through `$geoNear`. The count
    // still runs off `query`, whose `$geoWithin` covers exactly the same set as
    // the stage's `maxDistance` — no second aggregation just to total them.
    const findPage = async () => {
      if (usesGeoNear && center) {
        const { location: _geoWithin, ...rest } = query;
        return Service.aggregate([
          buildGeoNearStage(center, rest),
          { $skip: getSkip(params) },
          { $limit: params.limit },
        ]);
      }

      const listQuery = Service.find(query)
        .sort(sort)
        .skip(getSkip(params))
        .limit(params.limit);

      // Sorting by relevance requires the score to be projected as well.
      if (usesTextScore) listQuery.select({ score: { $meta: "textScore" } });

      return listQuery.lean();
    };

    const [data, total] = await Promise.all([
      findPage(),
      Service.countDocuments(query),
    ]);

    return NextResponse.json({
      data: data.map((item) => toPublicService(item, center)),
      meta: buildMeta(params, total),
    });
  } catch (error) {
    console.error("GET /api/services failed", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 },
    );
  }
}

/**
 * @openapi
 * /api/services:
 *   post:
 *     summary: Publish a new service
 *     description: The authenticated user becomes the owner and the only one who can edit it.
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ServiceInput' }
 *     responses:
 *       201:
 *         description: The created service.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service: { $ref: '#/components/schemas/Service' }
 *       400:
 *         description: Validation failed, or the image key has no upload behind it.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { description: Missing, invalid or expired access token. }
 *       403: { description: The image key belongs to another user. }
 *       413: { description: The uploaded image is over the size limit. }
 *       415: { description: The uploaded image is not a supported type. }
 *       500: { description: Server error. }
 */
export async function POST(request: Request) {
  try {
    return await new CreateService({
      endpoint: "/api/services",
      method: "POST",
    }).submit(request);
  } catch (error) {
    console.error("POST /api/services failed", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 },
    );
  }
}
