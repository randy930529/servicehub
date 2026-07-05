import { NextResponse } from "next/server";

import { getOpenApiSpec } from "@/lib/swagger";

export const runtime = "nodejs";

/** Serves the generated OpenAPI 3 document consumed by the Swagger UI page. */
export async function GET() {
  return NextResponse.json(getOpenApiSpec());
}
