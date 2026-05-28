# Dockerfile — Langton Arena PvP MVP server (Stage 8 deploy).
#
# Используется Render.com (или любой Docker-compatible PaaS).
# Build context = repo root (нужен pnpm-workspace.yaml + langton-arena-backend/).
#
# Runtime: tsx (TypeScript on-the-fly), без отдельной compile стадии —
# @langton/core экспортирует .ts sources через "main": "src/index.ts".

FROM node:20-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Корневые workspace-маркеры + lockfile
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Backend monorepo manifests
COPY langton-arena-backend/package.json ./langton-arena-backend/
COPY langton-arena-backend/core/package.json ./langton-arena-backend/core/
COPY langton-arena-backend/services/mvp-server/package.json ./langton-arena-backend/services/mvp-server/

# Frontend pkg manifest нужен только для workspace resolve
COPY langton-arena-web/package.json ./langton-arena-web/

# Install только нужные workspace pkg + transitive deps.
# `...` синтаксис включает зависимые workspace packages (core).
RUN pnpm install --filter @langton/mvp-server... --frozen-lockfile=false

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy installed deps + source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/langton-arena-backend/node_modules ./langton-arena-backend/node_modules
COPY --from=deps /app/langton-arena-backend/core/node_modules ./langton-arena-backend/core/node_modules
COPY --from=deps /app/langton-arena-backend/services/mvp-server/node_modules ./langton-arena-backend/services/mvp-server/node_modules

# Source files
COPY pnpm-workspace.yaml ./
COPY langton-arena-backend/package.json ./langton-arena-backend/
COPY langton-arena-backend/core ./langton-arena-backend/core
COPY langton-arena-backend/services/mvp-server ./langton-arena-backend/services/mvp-server

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 8080

WORKDIR /app/langton-arena-backend/services/mvp-server
# tsx загружает .ts напрямую без compile stage — @langton/core re-exports
# .ts sources через "main": "src/index.ts", поэтому единственный путь.
CMD ["npx", "tsx", "./src/main.ts"]
