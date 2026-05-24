# services/matchmaker/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY core/package.json ./core/
COPY services/matchmaker/package.json ./services/matchmaker/
RUN corepack enable && pnpm install --frozen-lockfile
COPY core ./core
COPY services/matchmaker ./services/matchmaker
RUN pnpm --filter @langton/core build
RUN pnpm --filter @langton/matchmaker build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/core/package.json ./core/
COPY --from=builder /app/services/matchmaker/package.json ./services/matchmaker/
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY --from=builder /app/core/dist ./core/dist
COPY --from=builder /app/services/matchmaker/dist ./services/matchmaker/dist
USER node
CMD ["node", "services/matchmaker/dist/index.js"]
