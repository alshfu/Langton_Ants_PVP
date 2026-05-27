// src/router.ts
//
// Маршрутизация incoming WebSocket messages. Stage 8 Day 2 — все handlers
// stub'ы (логгирование + acknowledge). Реальная логика в Day 3-5:
//
//   Day 3: join_room, leave_room, set_ready  → Room state
//   Day 4: (внутренне) match_starting + match_tick
//   Day 5: deploy  → canDeploy + queue
//
// Public API: routeMessage(connection, rawData)

import { ERROR_CODES, isClientMessage, type ClientMessage } from './messages.js';
import type { Connection } from './connection.js';

/** Stub handler signature — для будущих real impls. */
export type Handler = (conn: Connection, msg: ClientMessage) => void;

/**
 * Парсит raw buffer/string как JSON, валидирует shape, передаёт в handler.
 * Любая ошибка → conn.sendError(...) и return (не throw).
 */
export function routeMessage(conn: Connection, raw: Buffer | string): void {
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
    // Differentiate: есть ли вообще type field?
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      conn.sendError(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    } else {
      conn.sendError(ERROR_CODES.MALFORMED_MESSAGE);
    }
    return;
  }

  // 3. Dispatch — stubs, реальная логика Day 3+
  dispatch(conn, parsed);
}

function dispatch(conn: Connection, msg: ClientMessage): void {
  switch (msg.type) {
    case 'join_room':
      // Day 3: добавить connection в Room, broadcast room_updated
      conn.setLocale(msg.locale);
      // Stub acknowledge: send room_joined с пустым players list
      conn.send({
        type: 'room_joined',
        roomCode: msg.roomCode,
        clientId: conn.clientId,
        players: [],
      });
      conn.roomCode = msg.roomCode;
      return;

    case 'leave_room':
      // Day 3: убрать из room, broadcast
      conn.roomCode = null;
      return;

    case 'set_ready':
      // Day 3: обновить ready flag, проверить условие старта
      if (!conn.roomCode) {
        conn.sendError(ERROR_CODES.NOT_IN_ROOM);
        return;
      }
      return;

    case 'deploy':
      // Day 5: канonical deploy flow с canDeploy validation
      if (!conn.roomCode) {
        conn.sendError(ERROR_CODES.NOT_IN_ROOM);
        return;
      }
      conn.sendError(ERROR_CODES.MATCH_NOT_ACTIVE);
      return;

    case 'ping':
      conn.send({
        type: 'pong',
        t: msg.t,
        serverT: Date.now(),
      });
      return;

    default: {
      // Exhaustiveness check на compile-time
      const _exhaustive: never = msg;
      void _exhaustive;
      conn.sendError(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    }
  }
}
