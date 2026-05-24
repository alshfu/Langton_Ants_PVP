// services/api-gateway/src/middlewares/auth.ts
//
// JWT verification middleware.
// Декоратор fastify-jwt уже регистрирует app.jwt.verify(). Этот файл — обёртка
// которая добавляет authenticated user в request как request.user.
//
// Использование в route:
//   app.get('/me', { onRequest: [authenticate] }, ...)

import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
    // TODO: проверить что user не забанен (lookup в users.is_banned)
    // TODO: rate limit per-user (отдельно от per-IP)
  } catch {
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or missing token' } });
  }
}

// Optional auth — позволяет анонимным пройти, но если есть токен — валидирует.
// Используется на public-эндпоинтах где наличие user меняет ответ
// (например, /players/:id возвращает больше данных авторизованному другу).
export async function authenticateOptional(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try { await req.jwtVerify(); } catch { /* ignore */ }
}
