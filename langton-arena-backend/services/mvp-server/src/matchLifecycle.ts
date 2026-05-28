// src/matchLifecycle.ts
//
// Match lifecycle helpers. Stage 8 Day 4.
//
// startMatchCountdown(room, ctx):
//   1. room.status = 'countdown'
//   2. broadcast match_starting (config, seed, matchId, countdownMs)
//   3. setTimeout countdownMs:
//        - если кто-то ушёл / room.status != 'countdown' → abort
//        - new Match(...), room.activeMatch = match, room.status = 'playing'
//        - broadcast match_started
//        - match.start() — начинается tick loop

import type { Room } from './room.js';
import type { ServerContext } from './serverContext.js';
import { Match } from './match.js';
import { defaultMatchConfig, SERVER_ENGINE_VERSION, PVP_MAX_FIELD } from './matchConfig.js';
import { ERROR_CODES } from './messages.js';

/**
 * Start match countdown. Idempotent — повторный вызов с активным countdown игнорируется.
 * Возвращает true если countdown стартанул, false если уже active или room invalid.
 */
export function startMatchCountdown(room: Room, ctx: ServerContext): boolean {
  if (room.activeMatch) return false;
  if (room.countdownHandle) return false;
  if (room.players.length < 2) return false;

  // Build config. PvP cap — sanity check (defaultMatchConfig=60×60, всегда OK).
  const seed = ctx.seedFn();
  const config = defaultMatchConfig(seed);
  if (config.width > PVP_MAX_FIELD || config.height > PVP_MAX_FIELD) {
    for (const p of room.players) p.sendError(ERROR_CODES.FIELD_TOO_LARGE_FOR_PVP);
    return false;
  }
  const matchId = ctx.matchIdFn();

  room.status = 'countdown';
  room.broadcast({
    type: 'match_starting',
    countdownMs: ctx.matchCountdownMs,
    config,
    seed,
    matchId,
  });

  room.countdownHandle = setTimeout(() => {
    room.countdownHandle = null;
    // Abort если room состояние изменилось (disconnect и т.п.)
    if (room.status !== 'countdown') return;
    if (room.players.length < 2) {
      room.status = 'lobby';
      return;
    }
    finalizeMatchStart(room, config, matchId, ctx);
  }, ctx.matchCountdownMs);

  return true;
}

/** Отменить активный countdown (используется при disconnect during countdown). */
export function cancelMatchCountdown(room: Room): void {
  if (room.countdownHandle) {
    clearTimeout(room.countdownHandle);
    room.countdownHandle = null;
  }
  if (room.status === 'countdown') {
    room.status = 'lobby';
  }
}

/** Завершить активный match (force end + cleanup).
 *  Day 13: также cleanup всех grace timers (если кто-то disconnected — теперь
 *  no-op, матч уже закончился). */
export function endActiveMatch(room: Room, reason: string, winnerIndex: number | null = null): void {
  if (!room.activeMatch) return;
  room.activeMatch.endWith(winnerIndex, reason);
  // status уже finished через finishAndBroadcast → теперь обнуляем match ref
  room.activeMatch = null;
  for (const timer of room.graceTimers.values()) clearTimeout(timer);
  room.graceTimers.clear();
}

// ─── private ─────────────────────────────────────────────────────────────────

function finalizeMatchStart(
  room: Room,
  config: ReturnType<typeof defaultMatchConfig>,
  matchId: string,
  ctx: ServerContext,
): void {
  const match = new Match(room, config, matchId, {
    tickIntervalMs: ctx.matchTickIntervalMs,
  });
  room.activeMatch = match;
  room.status = 'playing';

  room.broadcast({
    type: 'match_started',
    matchId,
    startedAt: Date.now(),
    serverEngineVersion: SERVER_ENGINE_VERSION,
  });

  match.start();
}
