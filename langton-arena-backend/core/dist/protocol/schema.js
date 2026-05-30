// core/src/protocol/schema.ts
//
// JSON-schema валидация всех входящих сообщений на бэкенде.
//
// Принцип defense-in-depth: TypeScript-типы помогают на стадии разработки,
// но в runtime клиент может прислать что угодно. Все сообщения от клиентов
// валидируются через ajv ДО передачи в handler'ы.
//
// Если сообщение не проходит валидацию → ws.close(1008, "policy violation").
//
// Schemas сгенерированы (вручную) из TypeScript типов в messages.ts.
// Альтернатива: автогенерация через typescript-json-schema, но в v1 хватит
// ручного поддержания.
import Ajv from 'ajv';
const ajv = new Ajv({ removeAdditional: 'all', useDefaults: true });
// ─────────────────────────────────────────────────────────────────────────────
// Базовая схема обёртки
// ─────────────────────────────────────────────────────────────────────────────
const baseEnvelope = {
    type: 'object',
    required: ['type', 'seq', 'ts'],
    properties: {
        type: { type: 'string', maxLength: 64 },
        seq: { type: 'integer', minimum: 0 },
        ts: { type: 'integer', minimum: 0 },
    },
};
// ─────────────────────────────────────────────────────────────────────────────
// Схемы по типам (только клиент→сервер; серверные — валидация TS-типов)
// ─────────────────────────────────────────────────────────────────────────────
const schemas = {
    'auth:hello': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string', minLength: 10, maxLength: 4096 } },
                additionalProperties: false,
            },
        },
    },
    'mm:join': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['mode'],
                properties: {
                    mode: { enum: ['arena', 'arena_ranked', 'arena_team', 'private'] },
                    options: {
                        type: 'object',
                        properties: {
                            preferredPlayerCount: { enum: [2, 4, 6, 8, 10] },
                            inviteCode: { type: 'string', pattern: '^[0-9]{6}$' },
                        },
                        additionalProperties: false,
                    },
                },
                additionalProperties: false,
            },
        },
    },
    'mm:leave': {
        ...baseEnvelope,
        properties: { ...baseEnvelope.properties, payload: { type: 'object', additionalProperties: false } },
    },
    'mm:accept': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['matchId'],
                properties: { matchId: { type: 'string', format: 'uuid' } },
                additionalProperties: false,
            },
        },
    },
    'lobby:squad_change': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['lobbyId', 'antIndex', 'ruleId'],
                properties: {
                    lobbyId: { type: 'string', format: 'uuid' },
                    antIndex: { type: 'integer', minimum: 0, maximum: 4 },
                    ruleId: { type: 'string', maxLength: 32 },
                },
                additionalProperties: false,
            },
        },
    },
    'lobby:chat': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['lobbyId', 'text'],
                properties: {
                    lobbyId: { type: 'string', format: 'uuid' },
                    text: { type: 'string', minLength: 1, maxLength: 200 },
                },
                additionalProperties: false,
            },
        },
    },
    'match:hello': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['matchId'],
                properties: {
                    matchId: { type: 'string', format: 'uuid' },
                    lastSeq: { type: 'integer', minimum: 0 },
                },
                additionalProperties: false,
            },
        },
    },
    'match:select_ant': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['matchId', 'antId'],
                properties: {
                    matchId: { type: 'string', format: 'uuid' },
                    antId: { type: 'string', maxLength: 64 },
                },
                additionalProperties: false,
            },
        },
    },
    'match:emote': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['matchId', 'emoteId'],
                properties: {
                    matchId: { type: 'string', format: 'uuid' },
                    emoteId: { type: 'string', maxLength: 32 },
                },
                additionalProperties: false,
            },
        },
    },
    'match:forfeit': {
        ...baseEnvelope,
        properties: {
            ...baseEnvelope.properties,
            payload: {
                type: 'object',
                required: ['matchId'],
                properties: { matchId: { type: 'string', format: 'uuid' } },
                additionalProperties: false,
            },
        },
    },
    ping: {
        ...baseEnvelope,
        properties: { ...baseEnvelope.properties, payload: { type: 'object', additionalProperties: false } },
    },
};
const validators = Object.fromEntries(Object.entries(schemas).map(([type, schema]) => [type, ajv.compile(schema)]));
/**
 * Валидирует входящее сообщение.
 *
 * @returns true если валидно. false если структура неверная — соединение
 *   следует закрыть (или хотя бы залогировать и игнорировать).
 *
 * Side-effect: removeAdditional удалит лишние поля прямо в объекте.
 */
export function validateMessage(msg) {
    if (!msg || typeof msg !== 'object')
        return false;
    const type = msg.type;
    if (typeof type !== 'string')
        return false;
    const validator = validators[type];
    if (!validator)
        return false; // неизвестный type → невалидно
    return validator(msg);
}
//# sourceMappingURL=schema.js.map