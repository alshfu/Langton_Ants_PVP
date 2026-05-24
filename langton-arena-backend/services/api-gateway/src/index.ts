// services/api-gateway/src/index.ts
//
// Bootstrap: читает env, создаёт server, запускает listen.
// Вся реальная конфигурация Fastify — в server.ts.

import { createServer } from './server';

const PORT = parseInt(process.env.API_PORT || '3000', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

async function main(): Promise<void> {
  const app = await createServer();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API Gateway listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }

  // Graceful shutdown
  const close = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, closing...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void close('SIGTERM'));
  process.on('SIGINT',  () => void close('SIGINT'));
}

void main();
