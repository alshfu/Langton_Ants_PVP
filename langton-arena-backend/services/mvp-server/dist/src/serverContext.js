// src/serverContext.ts
//
// ServerContext — DI bundle для router/handlers. Stage 8 Day 4.
//
// Содержит RoomManager + match timing options. Сервер создаёт один экземпляр
// при start(), передаёт через routeMessage → handlers.
//
// Для тестов timing можно ускорить (countdown 50ms, tick 5ms) чтобы тесты
// бежали за миллисекунды а не за 5+ секунд.
import { RoomManager } from './roomManager.js';
export function defaultSeedFn() {
    return (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
}
export function defaultMatchIdFn() {
    return `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
export function makeContext(opts = {}) {
    return {
        rooms: opts.rooms ?? new RoomManager(),
        matchCountdownMs: opts.matchCountdownMs ?? 3000,
        matchTickIntervalMs: opts.matchTickIntervalMs ?? 100,
        seedFn: opts.seedFn ?? defaultSeedFn,
        matchIdFn: opts.matchIdFn ?? defaultMatchIdFn,
        graceDisconnectMs: opts.graceDisconnectMs ?? 15_000,
    };
}
//# sourceMappingURL=serverContext.js.map