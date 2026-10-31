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
              bio: {
                type: "string",
                example: "Electricista con 10 años de experiencia.",
              },
              phone: { type: "string", example: "+52 33 1234 5678" },
              avatarUrl: {
                type: "string",
                nullable: true,
                description:
                  "Absolute URL derived from the stored object key; null when the user has no avatar.",
                example:
                  "http://localhost:9000/avatars/665f1b2c9a1b2c3d4e5f6a7b/a1b2.jpg",
              },
            },
          },
          ValidationError: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["VALIDATION_ERROR", "BODY_ERROR", "UNKNOWN_ERROR"],
              },
              message: { type: "string", example: "Invalid body" },
              errors: {
                type: "object",
                nullable: true,
                description:
                  "Zod issues keyed by field path. Object-level issues use the `_` key.",
                additionalProperties: {
                  type: "array",
                  items: { type: "string" },
                },
                example: { name: ["Too small: expected string to have >=2 characters"] },
              },
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
          ServiceLocation: {
            type: "object",
            description:
              "Coordinates in human order. Stored internally as a GeoJSON point ([lng, lat]).",
            required: ["lat", "lng"],
            properties: {
              lat: { type: "number", format: "float", example: 20.6597 },
              lng: { type: "number", format: "float", example: -103.3496 },
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
              imageUrl: {
                type: "string",
                nullable: true,
                description:
                  "Absolute URL derived from the stored object key; null when the service has no photo.",
                example:
                  "http://localhost:9000/service-images/665f1b2c9a1b2c3d4e5f6a7b/a1b2.jpg",
              },
              ownerId: {
                type: "string",
                nullable: true,
                description:
                  "User allowed to edit or delete it. Null for the seeded catalog, which nobody owns.",
              },
              location: {
                allOf: [{ $ref: "#/components/schemas/ServiceLocation" }],
                nullable: true,
              },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          ServiceInput: {
            type: "object",
            required: ["name", "description", "category", "priceFromCents"],
            properties: {
              name: { type: "string", minLength: 3, maxLength: 80 },
              description: { type: "string", minLength: 20, maxLength: 600 },
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
              priceFromCents: {
                type: "integer",
                minimum: 0,
                maximum: 100000000,
                description: "Starting price in MXN cents.",
              },
              providerName: {
                type: "string",
                minLength: 2,
                maxLength: 60,
                description: "Defaults to the owner's own name when omitted.",
              },
              imageKey: {
                type: "string",
                nullable: true,
                description:
                  "Key returned by /api/services/image/upload-url. Null clears the photo.",
              },
              location: {
                allOf: [{ $ref: "#/components/schemas/ServiceLocation" }],
                nullable: true,
                description: "Null removes it from radius search.",
              },
            },
          },
          Payment: {
            type: "object",
            description:
              "Mirrors a Stripe PaymentIntent. No card data and no client_secret ever appear here.",
            properties: {
              _id: { type: "string" },
              reservationId: { type: "string" },
              amountCents: { type: "integer", example: 45000 },
              currency: { type: "string", example: "mxn" },
              status: {
                type: "string",
                enum: [
                  "requires_payment",
                  "processing",
                  "succeeded",
                  "failed",
                  "canceled",
                ],
              },
              lastError: { type: "string", nullable: true },
            },
          },
          Review: {
            type: "object",
            properties: {
              _id: { type: "string" },
              serviceId: { type: "string" },
              authorName: { type: "string", example: "Randy" },
              rating: { type: "integer", minimum: 1, maximum: 5 },
              comment: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          Reputation: {
            type: "object",
            description:
              "Bayesian `score` is what the catalog sorts by; `average` is the plain mean and the one to display.",
            properties: {
              score: { type: "number", example: 4.43 },
              average: { type: "number", example: 5 },
              reviewCount: { type: "integer", example: 2 },
            },
          },
          Reservation: {
            type: "object",
            description:
              "A booking of a service. `priceAtBookingCents` is a snapshot: the provider may reprice later, but this is what was agreed.",
            properties: {
              _id: { type: "string" },
              service: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string", example: "Limpieza de hogar" },
                  imageUrl: { type: "string", nullable: true },
                },
              },
              customerId: { type: "string" },
              providerId: { type: "string" },
              scheduledFor: { type: "string", format: "date-time" },
              status: {
                type: "string",
                enum: ["pending", "confirmed", "cancelled"],
              },
              priceAtBookingCents: { type: "integer", example: 45000 },
              cancelledAt: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
            },
          },
          Device: {
            type: "object",
            description: "A device registered to receive push notifications.",
            properties: {
              token: {
                type: "string",
                example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
              },
              platform: { type: "string", enum: ["ios", "android", "web"] },
              deviceName: { type: "string", nullable: true, example: "Pixel 7" },
              lastSeenAt: {
                type: "string",
                format: "date-time",
                description: "Refreshed every time the app re-registers.",
              },
            },
          },
          Conversation: {
            type: "object",
            description:
              "A 1:1 thread, already resolved for the caller: `peer` is the other person and `hasUnread` is from the caller's point of view, so the same document renders differently for each side.",
            properties: {
              _id: { type: "string" },
              peer: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string", example: "Ana Pérez" },
                  avatarUrl: { type: "string", nullable: true },
                },
              },
              lastMessage: {
                type: "object",
                nullable: true,
                description: "Denormalized preview; null until someone writes.",
                properties: {
                  body: { type: "string", example: "¿Sigue disponible?" },
                  senderId: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
              hasUnread: {
                type: "boolean",
                description:
                  "A dot, not a count: derived from the last message and the caller's read mark.",
              },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          ChatMessage: {
            type: "object",
            properties: {
              _id: { type: "string" },
              conversationId: { type: "string" },
              senderId: { type: "string" },
              body: { type: "string", example: "Sí, mañana a las 10" },
              createdAt: { type: "string", format: "date-time" },
              readByPeer: {
                type: "boolean",
                description:
                  "Derived from the other person's read mark on the conversation, not stored per message. Only meaningful on your own messages.",
              },
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
