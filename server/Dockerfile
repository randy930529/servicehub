# syntax=docker/dockerfile:1

# Next.js 16 backend (server/). Multi-stage: install deps once, build, and run.
# Uses pnpm via corepack, matching the repo's package manager.

# ---- deps: install all dependencies (dev deps included — needed to build) ----
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# The root pnpm-workspace.yaml (which approves build scripts) isn't in this
# build context, and this pnpm treats ignored builds as a fatal error. The
# skipped scripts (sharp, esbuild, …) are optional here, so downgrade to a warning.
RUN pnpm install --frozen-lockfile --config.strict-dep-builds=false

# ---- dev: hot-reload dev server (next dev) — used by the dev compose ----
FROM node:24-alpine AS dev
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---- builder: compile the production build ----
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- runner: production server (next start) ----
# node_modules is kept full (not prod-only) on purpose: Swagger scans
# ./app/api/**/*.ts at runtime and `pnpm seed` needs tsx (a devDependency).
FROM node:24-alpine AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY . .
EXPOSE 3000
CMD ["pnpm", "start"]
