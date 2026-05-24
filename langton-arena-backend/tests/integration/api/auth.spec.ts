// tests/integration/api/auth.spec.ts
//
// E2E через настоящий fastify-сервер с настоящим Postgres (из docker-compose).
// Запуск: pnpm test:integration

import { describe, it } from 'vitest';

describe('Auth API', () => {
  it.todo('POST /auth/register creates user and returns tokens');
  it.todo('POST /auth/register with duplicate username returns 409');
  it.todo('POST /auth/login with wrong password returns 401');
  it.todo('POST /auth/refresh rotates refresh token');
  it.todo('after 5 wrong logins from same IP, CAPTCHA required');
});
