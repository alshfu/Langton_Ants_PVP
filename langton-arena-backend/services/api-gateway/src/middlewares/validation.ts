// services/api-gateway/src/middlewares/validation.ts
//
// Helpers для JSON-schema валидации тел запросов.
// Fastify умеет это нативно через `schema` в route options. Этот файл — типизированные
// helper'ы и общие схемы (например, username validation, email validation).

export const usernameSchema = {
  type: 'string',
  minLength: 3,
  maxLength: 20,
  pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
} as const;

export const emailSchema = {
  type: 'string',
  format: 'email',
  maxLength: 255,
} as const;

export const passwordSchema = {
  type: 'string',
  minLength: 8,
  maxLength: 128,
  // Требуем минимум одну букву и одну цифру (проверим в коде, regex здесь слишком зол)
} as const;

export const uuidSchema = {
  type: 'string',
  format: 'uuid',
} as const;

// TODO: добавить помощник вроде `validateRules(req, schemas)` для сложных кастомных проверок,
// которые не покрываются JSON-schema (например, проверка что username не зарезервирован).
