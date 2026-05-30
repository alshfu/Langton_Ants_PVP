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

  // Build config. PvP cap — sanity check.
  // Stage 9.1: apply room.configOverrides (host customized в lobby).
  const seed = ctx.seedFn();
  let config = defaultMatchConfig(seed);
  if (Object.keys(room.configOverrides).length > 0) {
    config = { ...config, ...room.configOverrides } as typeof config;
    // Deep-merge winCondition if specified
    if (room.configOverrides.winCondition && typeof room.configOverrides.winCondition === 'object') {
      config.winCondition = {
        ...config.winCondition,
        ...(room.configOverrides.winCondition as object),
      };
    }
  }
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

/**
 * Day 15: вооружить orphan-lobby таймер. Если в room <2 живых connections
 * за `lobbyTimeoutMs` ms — оставшемуся player'у шлём ROOM_TIMEOUT + cleanup.
 * Idempotent: повторный вызов с активным таймером — no-op.
 */
export function armLobbyTimeout(room: Room, ctx: ServerContext): void {
  if (room.lobbyTimeoutHandle) return; // уже armed
  if (room.status !== 'lobby') return; // не в lobby — не нужен
  room.lobbyTimeoutHandle = setTimeout(() => {
    room.lobbyTimeoutHandle = null;
    // Re-check: если за это время появился 2-й — abort
    if (room.players.filter((p) => !p.disconnected).length >= 2) return;
    // Notify оставшихся
    for (const p of room.players) {
      if (!p.disconnected) p.sendError(ERROR_CODES.ROOM_TIMEOUT);
    }
    // Cleanup: rooms.delete + leaveCurrentRoom для каждого
    for (const p of [...room.players]) {
      p.roomCode = null;
      p.ready = false;
    }
    room.players.length = 0;
    ctx.rooms.delete(room.code);
  }, ctx.lobbyTimeoutMs);
}

/** Disarm timer (когда 2-й присоединился или match закончился). */
export function disarmLobbyTimeout(room: Room): void {
  if (room.lobbyTimeoutHandle) {
    clearTimeout(room.lobbyTimeoutHandle);
    room.lobbyTimeoutHandle = null;
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

// ─── Day 23: Rematch flow ────────────────────────────────────────────────────

/** Day 23: rematch timeout — если за это время не пришло второе intent. */
const REMATCH_TIMEOUT_MS = 60_000;

/**
 * Day 23: записать намерение игрока на rematch. Если оба согласились —
 * resetMatch'аем room в lobby. Иначе arm 60s timeout и broadcast status.
 */
export function requestRematch(room: Room, clientId: string): void {
  if (room.status !== 'finished') return; // только после match_ended
  // Игрок должен быть в комнате
  if (!room.findPlayer(clientId)) return;
  room.rematchRequests.add(clientId);

  const liveCount = room.liveCount();
  const agreed = Array.from(room.rematchRequests);

  // Broadcast статус всем — UI оппонента покажет "X wants rematch"
  room.broadcast({
    type: 'rematch_status',
    bothAgreed: agreed.length >= liveCount && liveCount >= 2,
    agreedClientIds: agreed,
  });

  if (agreed.length >= liveCount && liveCount >= 2) {
    // Оба согласились → reset
    resetForRematch(room);
  } else if (!room.rematchTimeoutHandle) {
    // Arm timeout — если оппонент не согласится за 60s, очищаем
    room.rematchTimeoutHandle = setTimeout(() => {
      room.rematchRequests.clear();
      room.rematchTimeoutHandle = null;
      room.broadcast({
        type: 'rematch_status',
        bothAgreed: false,
        agreedClientIds: [],
      });
    }, REMATCH_TIMEOUT_MS);
  }
}

/**
 * Day 23: reset room обратно в lobby для rematch. Очищает activeMatch,
 * сбрасывает ready flag для всех игроков, broadcast rematch_reset +
 * room_updated.
 */
export function resetForRematch(room: Room): void {
  // Cleanup rematch state
  if (room.rematchTimeoutHandle) {
    clearTimeout(room.rematchTimeoutHandle);
    room.rematchTimeoutHandle = null;
  }
  room.rematchRequests.clear();
  // Match cleanup
  if (room.activeMatch) {
    room.activeMatch.stop();
    room.activeMatch = null;
  }
  // Reset ready flags
  for (const conn of room.players) {
    conn.ready = false;
  }
  // Status back to lobby
  room.status = 'lobby';
  // Broadcast reset → клиенты сбросят phase='lobby' и matchResult
  room.broadcast({ type: 'rematch_reset' });
  // И обновлённый roster (всем ready=false)
  room.broadcast({ type: 'room_updated', players: room.getPlayerInfos() });
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
    persistence: ctx.persistence,
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
