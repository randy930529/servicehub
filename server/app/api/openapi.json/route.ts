import { getOpenApiSpec } from "@/app/lib/swagger";
import { NextResponse } from "next/server";

/** Serves the generated OpenAPI 3 document consumed by the Swagger UI page. */
export async function GET() {
  return NextResponse.json(getOpenApiSpec());
}
