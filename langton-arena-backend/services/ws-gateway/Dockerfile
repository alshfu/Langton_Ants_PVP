# services/ws-gateway/Dockerfile
# Multi-stage build аналогичен api-gateway. См. README сервиса.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/package.json ./core/
COPY services/ws-gateway/package.json ./services/ws-gateway/
RUN corepack enable && pnpm install --frozen-lockfile
COPY core ./core
COPY services/ws-gateway ./services/ws-gateway
RUN pnpm --filter @langton/core build
RUN pnpm --filter @langton/ws-gateway build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/core/package.json ./core/
COPY --from=builder /app/services/ws-gateway/package.json ./services/ws-gateway/
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/core/dist ./core/dist
COPY --from=builder /app/services/ws-gateway/dist ./services/ws-gateway/dist
EXPOSE 3001
USER node
CMD ["node", "services/ws-gateway/dist/index.js"]
