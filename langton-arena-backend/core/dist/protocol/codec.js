// core/src/protocol/codec.ts
//
// MessagePack encode/decode для WS сообщений.
//
// Почему MessagePack а не JSON:
//   - На матч 5 минут × 10 TPS × 100 КБ payload = ~300 МБ трафика на игрока.
//   - MessagePack даёт экономию ~40% по сравнению с JSON.
//   - Бинарный формат → меньше CPU на парсинг.
//   - Protobuf был бы ещё на 20% меньше, но сложнее в поддержке. В v1 — msgpack.
//
// Использование:
//   const buffer = encodeMessage(msg);     // → ArrayBuffer для ws.send
//   const msg = decodeMessage(buffer);     // ← Buffer от ws.on('message')
import { encode, decode } from '@msgpack/msgpack';
/**
 * Сериализует сообщение в бинарный буфер для отправки по WS.
 * Не валидирует — валидация на отправителе через TypeScript типы.
 */
export function encodeMessage(msg) {
    // TODO: применить msgpack encode с настройками:
    //   - useBigInt64: false (числа всё в Number)
    //   - ignoreUndefined: true (опциональные поля не сериализуются)
    return encode(msg, { ignoreUndefined: true });
}
/**
 * Десериализует бинарный буфер в сообщение.
 * Используется на принимающей стороне ПОСЛЕ rate-limit и BEFORE validation.
 *
 * Валидация структуры — отдельным шагом через schema.ts.
 */
export function decodeMessage(buf) {
    // TODO: msgpack decode
    return decode(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf);
}
/**
 * Type guard: сообщение от клиента?
 * Используется в WS Gateway при роутинге.
 */
export function isClientMessage(msg) {
    if (!msg || typeof msg !== 'object')
        return false;
    const t = msg.type;
    if (typeof t !== 'string')
        return false;
    // TODO: перечислить все валидные type
    return t.startsWith('auth:') || t.startsWith('mm:') ||
        t.startsWith('lobby:') || t.startsWith('match:') || t === 'ping';
}
/**
 * Type guard: сообщение от сервера?
 * Используется на клиенте при роутинге входящих.
 */
export function isServerMessage(msg) {
    if (!msg || typeof msg !== 'object')
        return false;
    const t = msg.type;
    return typeof t === 'string';
}
//# sourceMappingURL=codec.js.map