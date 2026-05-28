// src/main.ts
//
// Entry point для локального запуска mvp-server.
// Usage:
//   pnpm --filter @langton/mvp-server dev    # tsx watch
//   pnpm --filter @langton/mvp-server start  # built dist

import { MvpServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);
// Cloud deploy (Render/Cloud Run/etc) требует listen на 0.0.0.0 чтобы
// принимать внешний трафик. Локально 127.0.0.1 ограничивает loopback.
const HOST = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

const server = new MvpServer({ port: PORT, host: HOST });

server.start().then(({ host, port }) => {
  console.log(`[mvp-server] ready at ws://${host}:${port}`);
  console.log('[mvp-server] Stage 8 Day 2 boilerplate — handlers are stubs');
  console.log('[mvp-server] CTRL+C to stop');
}).catch((err) => {
  console.error('[mvp-server] failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n[mvp-server] received ${signal}, shutting down...`);
  server.stop().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('[mvp-server] shutdown error:', err);
    process.exit(1);
  });
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
