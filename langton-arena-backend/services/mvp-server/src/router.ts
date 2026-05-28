// src/router.ts
//
// Маршрутизация incoming WebSocket messages.
// Stage 8 Day 4: ServerContext (rooms + timing) + match countdown trigger.
// Stage 8 Day 5: deploy → canDeploy validation.

import { ERROR_CODES, isClientMessage, type ClientMessage } from './messages.js';
import type { Connection } from './connection.js';
import type { ServerContext } from './serverContext.js';
import { isValidNickname } from './nicknames.js';
import {
  startMatchCountdown,
  cancelMatchCountdown,
  endActiveMatch,
} from './matchLifecycle.js';

/**
 * Парсит raw buffer/string как JSON, валидирует shape, передаёт в handler.
 * Любая ошибка → conn.sendError(...) и return (не throw).
 */
export function routeMessage(conn: Connection, raw: Buffer | string, ctx: ServerContext): void {
  let parsed: unknown;
  try {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    parsed = JSON.parse(text);
  } catch {
    conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }

  if (!isClientMessage(parsed)) {
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      conn.sendError(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    } else {
      conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    }
    return;
  }

  dispatch(conn, parsed, ctx);
}

function dispatch(conn: Connection, msg: ClientMessage, ctx: ServerContext): void {
  switch (msg.type) {
    case 'join_room':       return handleJoinRoom(conn, msg, ctx);
    case 'leave_room':      return handleLeaveRoom(conn, ctx);
    case 'set_ready':       return handleSetReady(conn, msg, ctx);
    case 'deploy':          return handleDeploy(conn, msg, ctx);
    case 'ping':            return handlePing(conn, msg);
    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
      conn.sendError(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    }
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

function handleJoinRoom(
  conn: Connection,
  msg: Extract<ClientMessage, { type: 'join_room' }>,
  ctx: ServerContext,
): void {
  if (!isValidNickname(msg.nickname)) {
    conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }
  if (msg.roomCode.length === 0 || msg.roomCode.length > 64) {
    conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }

  conn.setLocale(msg.locale);
  conn.nickname = msg.nickname;

  if (conn.roomCode && conn.roomCode !== msg.roomCode) {
    leaveCurrentRoom(conn, ctx);
  }

  const room = ctx.rooms.getOrCreate(msg.roomCode);
  const added = room.addPlayer(conn);
  if (!added) {
    conn.sendError(ERROR_CODES.ROOM_FULL);
    return;
  }

  conn.send({
    type: 'room_joined',
    roomCode: room.code,
    clientId: conn.clientId,
    players: room.getPlayerInfos(),
  });
  room.broadcast({
    type: 'room_updated',
    players: room.getPlayerInfos(),
  });
}

function handleLeaveRoom(conn: Connection, ctx: ServerContext): void {
  leaveCurrentRoom(conn, ctx);
}

function handleSetReady(
  conn: Connection,
  msg: Extract<ClientMessage, { type: 'set_ready' }>,
  ctx: ServerContext,
): void {
  if (!conn.roomCode) {
    conn.sendError(ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  const room = ctx.rooms.get(conn.roomCode);
  if (!room) {
    conn.sendError(ERROR_CODES.ROOM_NOT_FOUND);
    return;
  }

  // Stage 8 Day 4: ready нельзя менять во время countdown/playing — игнорируем.
  // Иначе race condition: оба ready → countdown → один un-ready'ится → countdown abort.
  if (room.status !== 'lobby') {
    return;
  }

  conn.ready = msg.ready;
  room.broadcast({
    type: 'room_updated',
    players: room.getPlayerInfos(),
  });

  // Stage 8 Day 4: trigger match_starting countdown когда allReady
  if (room.allReady()) {
    startMatchCountdown(room, ctx);
  }
}

function handleDeploy(
  conn: Connection,
  msg: Extract<ClientMessage, { type: 'deploy' }>,
  ctx: ServerContext,
): void {
  if (!conn.roomCode) {
    conn.sendError(ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  const room = ctx.rooms.get(conn.roomCode);
  if (!room) {
    conn.sendError(ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  if (!room.activeMatch || room.status !== 'playing') {
    conn.sendError(ERROR_CODES.MATCH_NOT_ACTIVE);
    return;
  }
  // Найти индекс игрока в config.players по позиции в room
  const playerIdx = room.players.indexOf(conn);
  if (playerIdx < 0) {
    conn.sendError(ERROR_CODES.NOT_IN_ROOM);
    return;
  }

  const v = room.activeMatch.validateAndQueueDeploy(playerIdx, msg.x, msg.y, msg.tick);
  if (!v.ok) {
    // Day 10: context = координаты rejected deploy, для client prediction rollback.
    const ctx2 = { x: msg.x, y: msg.y, tick: msg.tick };
    if (v.reason === 'Input too old') {
      conn.sendError(ERROR_CODES.INPUT_TOO_OLD, ctx2);
    } else {
      conn.sendError(ERROR_CODES.INVALID_DEPLOY, ctx2);
    }
  }
  // На успех — нет ack. Клиент увидит deploy в next match_tick.
}

function handlePing(
  conn: Connection,
  msg: Extract<ClientMessage, { type: 'ping' }>,
): void {
  conn.send({
    type: 'pong',
    t: msg.t,
    serverT: Date.now(),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Снять connection с его текущего room (если есть), broadcast обновление,
 * cancel countdown если шёл, end match если активен, удалить пустой room.
 * Используется в leave_room + при ws.close().
 */
export function leaveCurrentRoom(conn: Connection, ctx: ServerContext): void {
  if (!conn.roomCode) return;
  const room = ctx.rooms.get(conn.roomCode);
  if (!room) {
    conn.roomCode = null;
    return;
  }

  // Day 4: если был активный match — оппонент побеждает по disconnect
  if (room.activeMatch && !room.activeMatch.isFinished) {
    const leavingIdx = room.players.indexOf(conn);
    const winnerIdx = leavingIdx === 0 ? 1 : 0;
    endActiveMatch(room, 'opponent_disconnected', winnerIdx);
  }

  // Day 4: если шёл countdown — отменить
  if (room.status === 'countdown') {
    cancelMatchCountdown(room);
  }

  room.removePlayer(conn);

  if (room.isEmpty()) {
    // Cleanup active match interval если ещё не остановлен
    if (room.activeMatch && !room.activeMatch.isFinished) {
      room.activeMatch.stop();
    }
    room.activeMatch = null;
    ctx.rooms.delete(room.code);
  } else {
    room.broadcast({
      type: 'room_updated',
      players: room.getPlayerInfos(),
    });
  }
}
