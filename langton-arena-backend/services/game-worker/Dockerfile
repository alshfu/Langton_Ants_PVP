# services/game-worker/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/package.json ./core/
COPY services/game-worker/package.json ./services/game-worker/
RUN corepack enable && pnpm install --frozen-lockfile
COPY core ./core
COPY services/game-worker ./services/game-worker
RUN pnpm --filter @langton/core build
RUN pnpm --filter @langton/game-worker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/core/package.json ./core/
COPY --from=builder /app/services/game-worker/package.json ./services/game-worker/
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/core/dist ./core/dist
COPY --from=builder /app/services/game-worker/dist ./services/game-worker/dist
USER node
CMD ["node", "services/game-worker/dist/index.js"]
