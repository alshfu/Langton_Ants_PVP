// src/router.ts
//
// Маршрутизация incoming WebSocket messages.
// Stage 8 Day 3: реальная Room logic.
// Stage 8 Day 4+: match_starting trigger когда allReady().
// Stage 8 Day 5: deploy → canDeploy validation.

import { ERROR_CODES, isClientMessage, type ClientMessage } from './messages.js';
import type { Connection } from './connection.js';
import type { RoomManager } from './roomManager.js';
import { isValidNickname } from './nicknames.js';

/**
 * Парсит raw buffer/string как JSON, валидирует shape, передаёт в handler.
 * Любая ошибка → conn.sendError(...) и return (не throw).
 */
export function routeMessage(conn: Connection, raw: Buffer | string, rooms: RoomManager): void {
  // 1. Parse JSON
  let parsed: unknown;
  try {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    parsed = JSON.parse(text);
  } catch {
    conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }

  // 2. Validate shape
  if (!isClientMessage(parsed)) {
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      conn.sendError(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    } else {
      conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    }
    return;
  }

  dispatch(conn, parsed, rooms);
}

function dispatch(conn: Connection, msg: ClientMessage, rooms: RoomManager): void {
  switch (msg.type) {
    case 'join_room':       return handleJoinRoom(conn, msg, rooms);
    case 'leave_room':      return handleLeaveRoom(conn, rooms);
    case 'set_ready':       return handleSetReady(conn, msg, rooms);
    case 'deploy':          return handleDeploy(conn);
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
  rooms: RoomManager,
): void {
  // Validation
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

  // Если игрок был в другой комнате — выходим оттуда
  if (conn.roomCode && conn.roomCode !== msg.roomCode) {
    leaveCurrentRoom(conn, rooms);
  }

  const room = rooms.getOrCreate(msg.roomCode);
  const added = room.addPlayer(conn);
  if (!added) {
    conn.sendError(ERROR_CODES.ROOM_FULL);
    return;
  }

  // Ack игроку
  conn.send({
    type: 'room_joined',
    roomCode: room.code,
    clientId: conn.clientId,
    players: room.getPlayerInfos(),
  });

  // Broadcast всем в room (включая нового игрока — для consistency)
  room.broadcast({
    type: 'room_updated',
    players: room.getPlayerInfos(),
  });
}

function handleLeaveRoom(conn: Connection, rooms: RoomManager): void {
  leaveCurrentRoom(conn, rooms);
}

function handleSetReady(
  conn: Connection,
  msg: Extract<ClientMessage, { type: 'set_ready' }>,
  rooms: RoomManager,
): void {
  if (!conn.roomCode) {
    conn.sendError(ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  const room = rooms.get(conn.roomCode);
  if (!room) {
    conn.sendError(ERROR_CODES.ROOM_NOT_FOUND);
    return;
  }
  conn.ready = msg.ready;
  room.broadcast({
    type: 'room_updated',
    players: room.getPlayerInfos(),
  });
  // Day 4 hook: room.allReady() → trigger match_starting.
  // Day 3 — no-op (просто broadcast обновлённого state).
}

function handleDeploy(conn: Connection): void {
  if (!conn.roomCode) {
    conn.sendError(ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  // Day 5: canDeploy validation + queue
  conn.sendError(ERROR_CODES.MATCH_NOT_ACTIVE);
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
 * удалить пустой room из manager. Используется в leave_room + при disconnect.
 */
export function leaveCurrentRoom(conn: Connection, rooms: RoomManager): void {
  if (!conn.roomCode) return;
  const room = rooms.get(conn.roomCode);
  if (!room) {
    conn.roomCode = null;
    return;
  }
  room.removePlayer(conn);
  if (room.isEmpty()) {
    rooms.delete(room.code);
  } else {
    room.broadcast({
      type: 'room_updated',
      players: room.getPlayerInfos(),
    });
  }
}
