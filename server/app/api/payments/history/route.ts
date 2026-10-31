import { NextResponse } from "next/server";

import { authenticateRequest, authErrorResponse } from "@/app/lib/auth";
import { listPaymentHistory } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/history:
 *   get:
 *     summary: The caller's payment history
 *     description: >
 *       Always scoped to the authenticated customer — there is no "all
 *       payments" query to expose by accident. Includes refunded amounts, so
 *       a receipt shows what was actually kept.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Payments, newest first. }
 *       401: { description: Missing or invalid access token. }
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authErrorResponse(auth.reason);

    return NextResponse.json({ data: await listPaymentHistory(auth.user.id) });
  } catch (error) {
    console.error("GET /api/payments/history failed", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 },
    );
  }
}
