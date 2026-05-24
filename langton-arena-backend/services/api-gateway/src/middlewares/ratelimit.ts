// services/api-gateway/src/middlewares/ratelimit.ts
//
// Per-user rate limit поверх per-IP rate limit (тот в server.ts через @fastify/rate-limit).
// Хранилище — Redis (INCR + EXPIRE).
//
// Используется для тяжёлых endpoint-ов: /matchmaking/queue, /store/purchase, /reports.

import type { FastifyRequest, FastifyReply } from 'fastify';

export interface UserRateLimitOptions {
  /** Уникальное имя лимита, используется как часть Redis-ключа. */
  bucket: string;
  /** Сколько запросов допустимо в окне. */
  max: number;
  /** Окно в секундах. */
  windowSec: number;
}

export function userRateLimit(_opts: UserRateLimitOptions) {
  return async function (_req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    // TODO:
    // 1. Получить user_id из req.user (требует authenticate перед этим)
    // 2. Ключ: `ratelimit:${bucket}:${user_id}`
    // 3. INCR ключ, если 1 — EXPIRE windowSec
    // 4. Если значение > max — reply.code(429).send(...)
  };
}
