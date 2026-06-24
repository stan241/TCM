# TCM API — Docker build
# Multi-stage: build in node:20, run in node:20-slim (smaller image)
FROM node:20-alpine AS base
WORKDIR /app

# ── Stage 1: install all deps ─────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/api/package.json        ./packages/api/
COPY packages/shared/package.json     ./packages/shared/
COPY packages/db/package.json         ./packages/db/
RUN npm ci --workspace=packages/api --workspace=packages/shared --workspace=packages/db

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/packages/api/node_modules   ./packages/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/api     ./packages/api
COPY packages/shared  ./packages/shared
COPY packages/db      ./packages/db
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/api

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 tcmapi && \
    adduser  --system --uid 1001 tcmapi

COPY --from=builder --chown=tcmapi:tcmapi /app/packages/api/dist ./dist
COPY --from=deps    --chown=tcmapi:tcmapi /app/node_modules      ./node_modules
COPY --from=deps    --chown=tcmapi:tcmapi /app/packages/api/node_modules ./packages/api/node_modules

USER tcmapi
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
