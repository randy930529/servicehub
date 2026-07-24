# ServiceHub API (backend)

Minimal backend for ServiceHub — **Next.js** (App Router, API Routes) +
**Mongoose** + **MongoDB**. Scope so far: DB connection, `Service` model, a
paginated `GET /api/services`, OpenAPI/Swagger docs (week 6) and JWT auth with
rotated refresh tokens (week 8, see `docs/security/auth-tokens.md` at the repo
root).

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
cp .env.example .env.local   # then set NEXT_MONGODB_URI
pnpm seed                    # load the sample catalog into MongoDB
pnpm dev                     # http://localhost:3000
```

`.env.local` (git-ignored) holds the connection string:

```
NEXT_MONGODB_URI=mongodb://127.0.0.1:27017/servicehub
# or an Atlas URI: mongodb+srv://<user>:<pass>@<cluster>/servicehub

# JWT signing secret (required for the auth endpoints):
NEXT_JWT_SECRET=<long random string>
```

## Endpoints

| Method | Path                 | Description                                     |
| ------ | -------------------- | ----------------------------------------------- |
| GET    | `/api/services`      | Paginated catalog (`?page`, `?limit`)           |
| POST   | `/api/auth/register` | Create an account → session token pair          |
| POST   | `/api/auth/login`    | Email + password → session token pair           |
| POST   | `/api/auth/refresh`  | Rotate a refresh token → new token pair         |
| POST   | `/api/auth/logout`   | Revoke a refresh token (idempotent, 204)        |
| GET    | `/api/auth/me`       | Current user (requires `Authorization: Bearer`) |
| GET    | `/api/openapi.json`  | Generated OpenAPI 3 document                    |
| —      | `/api-doc`           | Swagger UI (interactive docs)                   |

Auth endpoints return a `SessionResponse`:

```json
{
  "user": { "_id": "…", "name": "…", "email": "…" },
  "accessToken": "<JWT, expires in 15 min>",
  "refreshToken": "<opaque single-use token, 30 days>",
  "expiresIn": 900
}
```

Access JWTs are signed with HS256 (`NEXT_JWT_SECRET`); refresh tokens are
stored **hashed** (SHA-256) on the user and **rotated on every refresh** —
each one works exactly once.

Response shape of `GET /api/services`:

```json
{
  "data": [
    /* Service[] */
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 6,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

`page` defaults to 1, `limit` to 10 (max 100). Invalid values fall back to the
defaults.

## Structure

```
app/
  api/
    services/route.ts        # GET /api/services (paginated)
    auth/
      register/route.ts      # POST /api/auth/register
      login/route.ts         # POST /api/auth/login
      refresh/route.ts       # POST /api/auth/refresh (rotation)
      logout/route.ts        # POST /api/auth/logout (revocation)
      me/route.ts            # GET /api/auth/me (Bearer-protected)
    openapi.json/route.ts    # serves the generated spec
  api-doc/                   # Swagger UI page
  lib/
    auth/
      tokens.ts              # JWT sign/verify + refresh token gen/hash
      passwords.ts           # bcrypt hash/verify
      session.ts             # issueSession (rotation), Bearer parsing
    definitions/             # shared types (pagination)
    helpers/
      pagination.ts          # pure pagination helpers (unit-tested)
      seed-data.ts           # sample catalog (mirrors the app's mock)
    models/
      service.ts             # Mongoose Service model
      user.ts                # Mongoose User model (+ hashed refresh tokens)
    scripts/
      seed.ts                # `pnpm seed`
    utils/
      environment.ts         # env parsing helpers
    mongoose.ts              # cached inline MongoDB connection
    swagger.ts               # OpenAPI spec (swagger-jsdoc)
__tests__/
  pagination.test.ts         # unit tests (node:test via tsx)
  auth-tokens.test.ts        # JWT + refresh token helpers
  auth-passwords.test.ts     # bcrypt helpers
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

- **Unit**: `pnpm test` runs pure-logic tests (pagination, JWT/refresh token
  helpers, password hashing) with the Node test runner via `tsx` — no DB
  required.
- **Manual/API**: import `postman/servicehub.postman_collection.json` into
  Postman (base URL `http://localhost:3000`) to exercise the endpoints.
