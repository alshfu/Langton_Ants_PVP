// core/src/protocol/stage8.ts
//
// WebSocket protocol для Stage 8 PvP MVP. Источник: spec §4.2.
// Day 6 Stage 8: переехало из mvp-server/src/messages.ts в @langton/core
// чтобы и frontend (WSClient) и server использовали одни типы.
//
// Все сообщения — JSON (не MessagePack в MVP). Discriminated union по `type`.
// Server возвращает error.locale = клиентский locale из join_room.
// ─── Error codes ─────────────────────────────────────────────────────────────
// Коды используются и в server-internal logic, и в i18n.ts для lookup.
// Любое новое error message → добавить код сюда + перевод в i18n.ts.
export const ERROR_CODES = {
    // Connection / routing
    MALFORMED_MESSAGE: 'MALFORMED_MESSAGE', // не валидный JSON или missing type
    UNKNOWN_MESSAGE_TYPE: 'UNKNOWN_MESSAGE_TYPE', // type не входит в ClientMessage
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED', // > 5 deploys/sec (Day 17)
    // Room
    ROOM_FULL: 'ROOM_FULL', // 2 players already
    ROOM_TIMEOUT: 'ROOM_TIMEOUT', // ждали Player B 5 минут
    ROOM_NOT_FOUND: 'ROOM_NOT_FOUND', // join_room после close
    NOT_IN_ROOM: 'NOT_IN_ROOM', // set_ready/deploy без join_room
    // Match
    MATCH_NOT_ACTIVE: 'MATCH_NOT_ACTIVE', // deploy в lobby
    INVALID_DEPLOY: 'INVALID_DEPLOY', // canDeploy() = false
    INPUT_TOO_OLD: 'INPUT_TOO_OLD', // deploy с tick < server.tick
    FIELD_TOO_LARGE_FOR_PVP: 'FIELD_TOO_LARGE_FOR_PVP', // > 200×200
    ENGINE_VERSION_MISMATCH: 'ENGINE_VERSION_MISMATCH', // client engine ≠ server
    // Day 13: reconnect
    RESUME_TOKEN_EXPIRED: 'RESUME_TOKEN_EXPIRED', // grace period истёк
};
// ─── Type guards ─────────────────────────────────────────────────────────────
/** Безопасная проверка что object — ClientMessage. */
export function isClientMessage(obj) {
    if (!obj || typeof obj !== 'object')
        return false;
    const m = obj;
    if (typeof m.type !== 'string')
        return false;
    // Минимальная shape-валидация per type. Глубокая — в handler'ах.
    switch (m.type) {
        case 'join_room':
            return typeof m.roomCode === 'string'
                && typeof m.nickname === 'string'
                && typeof m.locale === 'string';
        case 'leave_room':
            return true;
        case 'set_ready':
            return typeof m.ready === 'boolean';
        case 'deploy':
            return typeof m.x === 'number'
                && typeof m.y === 'number'
                && typeof m.tick === 'number';
        case 'ping':
            return typeof m.t === 'number';
        case 'request_rematch':
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=stage8.js.map