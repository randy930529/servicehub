import swaggerJsdoc from "swagger-jsdoc";

/**
 * Builds the OpenAPI spec from JSDoc `@openapi` annotations on the API route
 * files. Reusable models live in `components.schemas`.
 */
export function getOpenApiSpec() {
  return swaggerJsdoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "ServiceHub API",
        version: "0.1.0",
        description: "Minimal backend for the ServiceHub services catalog.",
      },
      servers: [{ url: "/", description: "Local server" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
        schemas: {
          User: {
            type: "object",
            properties: {
              _id: { type: "string", example: "665f1b2c9a1b2c3d4e5f6a7b" },
              name: { type: "string", example: "Ana Pérez" },
              email: { type: "string", format: "email" },
            },
          },
          SessionResponse: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
              accessToken: {
                type: "string",
                description: "Short-lived JWT for the Authorization header.",
              },
              refreshToken: {
                type: "string",
                description:
                  "Opaque single-use token to renew the session (rotated on refresh).",
              },
              expiresIn: {
                type: "integer",
                example: 900,
                description: "Access-token lifetime in seconds.",
              },
            },
          },
          Service: {
            type: "object",
            properties: {
              _id: { type: "string", example: "665f1b2c9a1b2c3d4e5f6a7b" },
              name: { type: "string", example: "Limpieza de hogar" },
              description: { type: "string" },
              category: {
                type: "string",
                enum: [
                  "hogar",
                  "belleza",
                  "tecnologia",
                  "bienestar",
                  "automotriz",
                ],
              },
              priceFromCents: { type: "integer", example: 45000 },
              rating: { type: "number", format: "float", example: 4.8 },
              providerName: { type: "string", example: "CleanPro" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          PaginationMeta: {
            type: "object",
            properties: {
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 10 },
              total: { type: "integer", example: 6 },
              totalPages: { type: "integer", example: 1 },
              hasNextPage: { type: "boolean" },
              hasPrevPage: { type: "boolean" },
            },
          },
        },
      },
    },
    // Scanned relative to the server package root (cwd of `next dev`/`build`).
    apis: ["./app/api/**/*.ts"],
  });
}
