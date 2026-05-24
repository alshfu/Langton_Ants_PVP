// services/api-gateway/src/utils/jwt.ts
//
// JWT helpers поверх @fastify/jwt.
// Главное чего здесь нет в Fastify-плагине из коробки — управление refresh tokens.

import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;          // user_id
  role: 'user' | 'admin' | 'mod';
  regions: string[];    // в каких регионах может играть
}

/**
 * Issue access + refresh token pair.
 * Refresh token хранится в Redis: refresh:{token_id} → { user_id, family, ip, created_at }.
 * Token rotation: при использовании refresh — старый инвалидируется, новый выдаётся.
 */
export async function issueTokenPair(
  _app: FastifyInstance,
  _userId: string,
  _ip: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // TODO:
  // 1. payload: AccessTokenPayload
  // 2. access = app.jwt.sign(payload, { expiresIn: '15m' })
  // 3. refresh = generateRefreshToken()
  // 4. Redis: SET refresh:{token_id} { user_id, family, ip } EX 30d
  // 5. Return { accessToken: access, refreshToken: refresh }
  throw new Error('not implemented');
}

export function generateRefreshToken(): string {
  // Случайные 32 байта в hex = 64 символа
  return randomBytes(32).toString('hex');
}

/**
 * Verify refresh token, rotate (выдать новый), вернуть user_id.
 * Suspicious behaviour (другой IP, другой UA) → инвалидируем всю family.
 */
export async function consumeRefreshToken(_token: string, _ip: string): Promise<{ userId: string } | null> {
  // TODO
  return null;
}
