// services/api-gateway/src/server.ts
//
// Создание Fastify-сервера со всеми плагинами, hooks и роутами.
//
// Подключаемые плагины (порядок важен):
//   1. helmet — security headers
//   2. cors — CORS для фронта
//   3. rate-limit — rate limiting через Redis
//   4. jwt — выпуск и верификация токенов
//   5. swagger — OpenAPI документация
//
// Регистрируем routes:
//   /api/v1/auth/*    — auth
//   /api/v1/me        — текущий пользователь
//   /api/v1/players/* — публичные профили
//   /api/v1/matches/* — матчи и replays
//   /api/v1/matchmaking/* — очереди (HTTP часть)
//   /api/v1/leaderboard/* — лидерборды
//   /api/v1/meta/*    — мета-статистика
//   /api/v1/store/*   — магазин
//   /api/v1/social/*  — друзья
//   /api/v1/reports   — жалобы

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { registerAuthRoutes } from './routes/auth';
import { registerMeRoutes } from './routes/me';
import { registerPlayersRoutes } from './routes/players';
import { registerMatchesRoutes } from './routes/matches';
import { registerMatchmakingRoutes } from './routes/matchmaking';
import { registerLeaderboardRoutes } from './routes/leaderboard';
import { registerMetaRoutes } from './routes/meta';
import { registerStoreRoutes } from './routes/store';
import { registerSocialRoutes } from './routes/social';
import { registerReportsRoutes } from './routes/reports';

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      // pino-pretty в dev, JSON в prod
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
    trustProxy: true,        // мы за load balancer'ом
  });

  // ─── Security & CORS ──────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (process.env.API_CORS_ORIGIN || '').split(','),
    credentials: true,
  });

  // ─── Rate limit ───────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    max: parseInt(process.env.RATELIMIT_API_PER_IP || '100', 10),
    timeWindow: '1 minute',
    // TODO: использовать Redis-backend для распределённого rate limit
  });

  // ─── JWT ──────────────────────────────────────────────────────────────────
  await app.register(jwt, {
    secret: {
      // TODO: загрузить ключи из infra/keys/jwt-private.pem и jwt-public.pem
      private: process.env.JWT_PRIVATE_KEY || 'dev-private-key-do-not-use-in-prod',
      public:  process.env.JWT_PUBLIC_KEY  || 'dev-public-key',
    },
    sign: { algorithm: 'RS256', expiresIn: process.env.JWT_ACCESS_TTL_SEC || '15m' },
    verify: { algorithms: ['RS256'] },
  });

  // ─── OpenAPI / Swagger ────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: { title: 'Langton Arena API', version: '1.0.0' },
      servers: [{ url: '/api/v1' }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // ─── Health check (не аутентифицированный) ────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));
  app.get('/ready',  async () => {
    // TODO: проверить Postgres и Redis соединения
    return { status: 'ready' };
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(async (api) => {
    await registerAuthRoutes(api);
    await registerMeRoutes(api);
    await registerPlayersRoutes(api);
    await registerMatchesRoutes(api);
    await registerMatchmakingRoutes(api);
    await registerLeaderboardRoutes(api);
    await registerMetaRoutes(api);
    await registerStoreRoutes(api);
    await registerSocialRoutes(api);
    await registerReportsRoutes(api);
  }, { prefix: '/api/v1' });

  // ─── Error handler ────────────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, url: request.url }, 'Request failed');
    // TODO: отправить в Sentry если NODE_ENV=production
    reply.status(error.statusCode || 500).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Something went wrong',
      },
    });
  });

  return app;
}
