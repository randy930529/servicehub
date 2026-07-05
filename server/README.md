# ServiceHub API (backend)

Minimal backend for the ServiceHub services catalog — **Next.js 14** (App Router,
API Routes) + **Mongoose** + **MongoDB**. Week 6 scope: DB connection, `Service`
model, a paginated `GET /api/services`, and OpenAPI/Swagger docs.

> Part of the `servicehub` monorepo. The mobile app lives in the repo root; this
> backend lives in `server/` with its own `package.json`.

## Requirements

- Node.js 20+
- pnpm
- A MongoDB instance (local `mongod` or MongoDB Atlas) — **connected inline via a
  connection string, no Docker.**

## Setup

```bash
cd server
pnpm install
cp .env.example .env.local   # then set MONGODB_URI
pnpm seed                    # load the sample catalog into MongoDB
pnpm dev                     # http://localhost:3000
```

`.env.local` (git-ignored) holds the connection string:

```
MONGODB_URI=mongodb://127.0.0.1:27017/servicehub
# or an Atlas URI: mongodb+srv://<user>:<pass>@<cluster>/servicehub
```

## Endpoints

| Method | Path                 | Description                                  |
| ------ | -------------------- | -------------------------------------------- |
| GET    | `/api/services`      | Paginated catalog (`?page`, `?limit`)        |
| GET    | `/api/openapi.json`  | Generated OpenAPI 3 document                 |
| —      | `/api-doc`           | Swagger UI (interactive docs)                |

Response shape of `GET /api/services`:

```json
{
  "data": [ /* Service[] */ ],
  "meta": {
    "page": 1, "limit": 10, "total": 6,
    "totalPages": 1, "hasNextPage": false, "hasPrevPage": false
  }
}
```

`page` defaults to 1, `limit` to 10 (max 100). Invalid values fall back to the
defaults.

## Structure

```
src/
  app/
    api/
      services/route.ts      # GET /api/services (paginated)
      openapi.json/route.ts  # serves the generated spec
    api-doc/                 # Swagger UI page
  lib/
    mongoose.ts              # cached inline MongoDB connection
    pagination.ts            # pure pagination helpers (unit-tested)
    swagger.ts               # OpenAPI spec (swagger-jsdoc)
    seed-data.ts             # sample catalog (mirrors the app's mock)
  models/
    service.ts               # Mongoose Service model
  scripts/
    seed.ts                  # `pnpm seed`
```

## Scripts

```bash
pnpm dev      # dev server
pnpm build    # production build
pnpm start    # run the production build
pnpm lint     # eslint
pnpm test     # unit tests (node:test via tsx) — pagination helpers
pnpm seed     # reset + seed the catalog
```

## Testing

- **Unit**: `pnpm test` runs pure-logic tests (pagination) with the Node test
  runner via `tsx` — no DB required.
- **Manual/API**: import `postman/servicehub.postman_collection.json` into
  Postman (base URL `http://localhost:3000`) to exercise the endpoints.
