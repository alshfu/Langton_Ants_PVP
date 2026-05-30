import type { WsMessage, ClientToServer, ServerToClient } from './messages';
/**
 * Сериализует сообщение в бинарный буфер для отправки по WS.
 * Не валидирует — валидация на отправителе через TypeScript типы.
 */
export declare function encodeMessage<T extends WsMessage>(msg: T): Uint8Array;
/**
 * Десериализует бинарный буфер в сообщение.
 * Используется на принимающей стороне ПОСЛЕ rate-limit и BEFORE validation.
 *
 * Валидация структуры — отдельным шагом через schema.ts.
 */
export declare function decodeMessage(buf: Uint8Array | ArrayBuffer): unknown;
/**
 * Type guard: сообщение от клиента?
 * Используется в WS Gateway при роутинге.
 */
export declare function isClientMessage(msg: unknown): msg is ClientToServer;
/**
 * Type guard: сообщение от сервера?
 * Используется на клиенте при роутинге входящих.
 */
export declare function isServerMessage(msg: unknown): msg is ServerToClient;
//# sourceMappingURL=codec.d.ts.map