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

export interface ServerContext {
  rooms: RoomManager;
  /** Сколько ms перед match_started (после allReady). Default 3000. */
  matchCountdownMs: number;
  /** Tick interval engine'а внутри match. Default 100 (10 TPS). */
  matchTickIntervalMs: number;
  /** Генератор seed для нового матча. Default Date.now() ^ Math.random*1e9. */
  seedFn: () => number;
  /** Генератор matchId. Default `match-${ts}-${rnd}`. */
  matchIdFn: () => string;
  /** Day 13: grace period для reconnect mid-match. Default 15000ms.
   *  Test override: 100. */
  graceDisconnectMs: number;
}

export function defaultSeedFn(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
}

export function defaultMatchIdFn(): string {
  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeContext(opts: Partial<ServerContext> = {}): ServerContext {
  return {
    rooms: opts.rooms ?? new RoomManager(),
    matchCountdownMs: opts.matchCountdownMs ?? 3000,
    matchTickIntervalMs: opts.matchTickIntervalMs ?? 100,
    seedFn: opts.seedFn ?? defaultSeedFn,
    matchIdFn: opts.matchIdFn ?? defaultMatchIdFn,
    graceDisconnectMs: opts.graceDisconnectMs ?? 15_000,
  };
}
