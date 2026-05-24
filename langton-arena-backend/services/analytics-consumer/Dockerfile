# services/analytics-consumer/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/package.json ./core/
COPY services/analytics-consumer/package.json ./services/analytics-consumer/
RUN corepack enable && pnpm install --frozen-lockfile
COPY core ./core
COPY services/analytics-consumer ./services/analytics-consumer
RUN pnpm --filter @langton/core build
RUN pnpm --filter @langton/analytics-consumer build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/core/package.json ./core/
COPY --from=builder /app/services/analytics-consumer/package.json ./services/analytics-consumer/
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/core/dist ./core/dist
COPY --from=builder /app/services/analytics-consumer/dist ./services/analytics-consumer/dist
USER node
CMD ["node", "services/analytics-consumer/dist/index.js"]
