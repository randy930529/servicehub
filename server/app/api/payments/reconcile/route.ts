import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/lib/auth";
import { reconcilePayments } from "@/app/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/payments/reconcile:
 *   get:
 *     summary: Compare our payment records against Stripe (admin only)
 *     description: >
 *       Reports drift, never repairs it. Stripe owns the money: an automatic
 *       fix that is wrong moves real funds, while a wrong report costs
 *       somebody five minutes. The runbook turns findings into actions.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200: { description: Checked count and any discrepancies. }
 *       404: { description: Not an admin. }
 *       503: { description: Payments are not configured. }
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit"));

    const report = await reconcilePayments(
      Number.isFinite(limit) && limit > 0 ? limit : 50,
    );

    if (!report) {
      return NextResponse.json(
        { error: "Payments are not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("GET /api/payments/reconcile failed", error);
    return NextResponse.json({ error: "Reconcile failed" }, { status: 500 });
  }
}
