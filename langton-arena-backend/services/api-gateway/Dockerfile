# services/api-gateway/Dockerfile
# Multi-stage build для production.
#
# Этап 1: builder — установка зависимостей и компиляция TypeScript.
# Этап 2: runner  — только продакшен-зависимости + скомпилированный код.

# === Stage 1: builder ========================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем workspace-метаданные сверху
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/package.json ./core/
COPY services/api-gateway/package.json ./services/api-gateway/

RUN corepack enable && pnpm install --frozen-lockfile

# Копируем исходники
COPY core ./core
COPY services/api-gateway ./services/api-gateway

RUN pnpm --filter @langton/core build
RUN pnpm --filter @langton/api-gateway build

# === Stage 2: runner =========================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Только prod-зависимости
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/core/package.json ./core/
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/

RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY --from=builder /app/core/dist                    ./core/dist
COPY --from=builder /app/services/api-gateway/dist    ./services/api-gateway/dist

# Healthcheck для k8s
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

EXPOSE 3000
USER node
CMD ["node", "services/api-gateway/dist/index.js"]
