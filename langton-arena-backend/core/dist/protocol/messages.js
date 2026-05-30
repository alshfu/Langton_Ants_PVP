// core/src/protocol/messages.ts
//
// Полный список сообщений WebSocket-протокола.
// Соответствие: docs/backend-architecture.md §4.3 и interface-contract.md §5.
//
// Принципы:
//   1. Каждое сообщение имеет фиксированный type (строка с двоеточием-namespace).
//   2. seq — порядковый номер сообщения (для упорядоченности при reconnect).
//   3. ts — server timestamp в мс (для измерения latency).
//   4. payload — типизированные данные конкретного сообщения.
//
// Все сообщения сериализуются через MessagePack (codec.ts).
// ═════════════════════════════════════════════════════════════════════════════
// Кодек (encode/decode через MessagePack)
// ═════════════════════════════════════════════════════════════════════════════
// Реализация — в codec.ts. Здесь re-export для удобства потребителей.
export { encodeMessage, decodeMessage } from './codec';
// Unused import suppression
void {};
//# sourceMappingURL=messages.js.map