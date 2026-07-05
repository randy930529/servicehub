"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

/** Client-only Swagger UI, pointed at the generated OpenAPI document. */
export default function ReactSwagger() {
  return <SwaggerUI url="/api/openapi.json" />;
}
