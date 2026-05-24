// services/api-gateway/src/utils/password.ts
//
// Хеширование паролей через Argon2id.
// Параметры из .env (ARGON2_MEMORY_KB, ARGON2_ITERATIONS, ARGON2_PARALLELISM).
//
// Defaults: memory=64MB, time=3, parallelism=4 — даёт ~150 мс на хеширование.

import argon2 from 'argon2';

const options = {
  type: argon2.argon2id,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_KB || '65536', 10),
  timeCost:   parseInt(process.env.ARGON2_ITERATIONS || '3', 10),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '4', 10),
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, options);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try { return await argon2.verify(hash, plain); }
  catch { return false; }
}

/**
 * Проверка силы пароля. Минимум 8 символов, минимум 1 буква, минимум 1 цифра.
 * (Регексп в JSON-schema этого не покрывает изящно — поэтому в коде.)
 */
export function isPasswordStrongEnough(plain: string): boolean {
  return plain.length >= 8 && /[a-zA-Z]/.test(plain) && /\d/.test(plain);
}
