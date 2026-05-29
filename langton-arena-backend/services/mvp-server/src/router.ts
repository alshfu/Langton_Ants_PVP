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
  armLobbyTimeout,
  disarmLobbyTimeout,
  endActiveMatch,
} from './matchLifecycle.js';

/**
 * Парсит raw buffer/string как JSON, валидирует shape, передаёт в handler.
 * Любая ошибка → conn.sendError(...) и return (не throw).
 *
 * Day 14: rate limiting + error budget enforcement.
 *   1. Любое incoming сообщение проходит через messageLimit (30/sec).
 *   2. Sendошибки (sendErrorWithBudget) учитываются в errorBudget. Если
 *      ≥5 errors за 10s → disconnect (broken client / DOS).
 *   3. RATE_LIMIT_EXCEEDED самим собой не bumps errorBudget (избежать
 *      feedback loop).
 */
export function routeMessage(conn: Connection, raw: Buffer | string, ctx: ServerContext): void {
  const now = Date.now();

  // Day 14: общий message rate gate. Превышение → silent drop + 1 error.
  if (!conn.messageLimit.tryHit(now)) {
    sendErrorWithBudget(conn, ERROR_CODES.RATE_LIMIT_EXCEEDED, undefined, /*countAsError*/ false);
    return;
  }

  let parsed: unknown;
  try {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    parsed = JSON.parse(text);
  } catch {
    sendErrorWithBudget(conn, ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }

  if (!isClientMessage(parsed)) {
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      sendErrorWithBudget(conn, ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    } else {
      sendErrorWithBudget(conn, ERROR_CODES.MALFORMED_MESSAGE);
    }
    return;
  }

  dispatch(conn, parsed, ctx);
}

/**
 * Day 14: send error + учесть в budget. Если bucket переполнен — closes
 * connection. Используется вместо conn.sendError для всех client-induced
 * ошибок чтобы броненую защиту получить автоматом.
 *
 * countAsError=false для RATE_LIMIT_EXCEEDED — иначе rate-limited клиент
 * disconnects через 1 секунду гарантированно.
 */
function sendErrorWithBudget(
  conn: Connection,
  code: string,
  context?: { x?: number; y?: number; tick?: number },
  countAsError: boolean = true,
): void {
  conn.sendError(code as Parameters<typeof conn.sendError>[0], context);
  if (countAsError && conn.recordError()) {
    conn.close('error-budget-exceeded');
  }
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
      sendErrorWithBudget(conn, ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
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
    sendErrorWithBudget(conn, ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }
  if (msg.roomCode.length === 0 || msg.roomCode.length > 64) {
    sendErrorWithBudget(conn, ERROR_CODES.MALFORMED_MESSAGE);
    return;
  }

  conn.setLocale(msg.locale);
  conn.nickname = msg.nickname;

  if (conn.roomCode && conn.roomCode !== msg.roomCode) {
    leaveCurrentRoom(conn, ctx);
  }

  const room = ctx.rooms.getOrCreate(msg.roomCode);

  // Day 13: resume path. Если room имеет disconnected slot с matching token
  // → swap dead conn на нового, cancel grace timer, send resume state.
  if (msg.resumeToken) {
    const found = room.findDisconnectedByToken(msg.resumeToken);
    if (found) {
      const slotIdx = found.idx;
      conn.adoptFrom(found.conn); // copy clientId, nickname, locale, roomCode, ready
      // Override nickname/locale из msg на случай если клиент сменил локаль
      conn.nickname = msg.nickname;
      conn.setLocale(msg.locale);
      room.players[slotIdx] = conn;
      // Cancel grace timer
      const timer = room.graceTimers.get(found.conn.resumeToken);
      if (timer) {
        clearTimeout(timer);
        room.graceTimers.delete(found.conn.resumeToken);
      }
      // Send resume state
      conn.send({
        type: 'room_joined',
        roomCode: room.code,
        clientId: conn.clientId,
        players: room.getPlayerInfos(),
        resumeToken: conn.resumeToken,
        resumed: true,
      });
      // Если матч активен — отправить полный state для catch-up
      if (room.activeMatch && !room.activeMatch.isFinished) {
        conn.send({
          type: 'match_resume_state',
          matchId: room.activeMatch.matchId,
          tick: room.activeMatch.currentTick,
          config: room.activeMatch.config,
          seed: room.activeMatch.seed,
          deployTimeline: [...room.activeMatch.deployTimeline],
        });
      }
      // Broadcast обновлённый list (опонент видит "reconnected")
      room.broadcast({ type: 'room_updated', players: room.getPlayerInfos() });
      return;
    }
    // Token не найден — silently fall through на normal join (не выдаём ошибку
    // чтобы не leak'нуть какие токены валидны).
  }

  const added = room.addPlayer(conn);
  if (!added) {
    sendErrorWithBudget(conn, ERROR_CODES.ROOM_FULL);
    return;
  }

  // Day 15: lobby timeout management.
  // - 1-й player → armLobbyTimeout (10 мин)
  // - 2-й player → disarm (есть пара)
  if (room.players.length >= 2) {
    disarmLobbyTimeout(room);
  } else {
    armLobbyTimeout(room, ctx);
  }

  conn.send({
    type: 'room_joined',
    roomCode: room.code,
    clientId: conn.clientId,
    players: room.getPlayerInfos(),
    resumeToken: conn.resumeToken,
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
    sendErrorWithBudget(conn, ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  const room = ctx.rooms.get(conn.roomCode);
  if (!room) {
    sendErrorWithBudget(conn, ERROR_CODES.ROOM_NOT_FOUND);
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
  // Day 14: deploy bucket (5/sec). Превышение → RATE_LIMIT_EXCEEDED + context
  // для client rollback ghost'a.
  if (!conn.deployLimit.tryHit(Date.now())) {
    sendErrorWithBudget(
      conn,
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      { x: msg.x, y: msg.y, tick: msg.tick },
      /*countAsError*/ false,
    );
    return;
  }

  if (!conn.roomCode) {
    sendErrorWithBudget(conn, ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  const room = ctx.rooms.get(conn.roomCode);
  if (!room) {
    sendErrorWithBudget(conn, ERROR_CODES.NOT_IN_ROOM);
    return;
  }
  if (!room.activeMatch || room.status !== 'playing') {
    sendErrorWithBudget(conn, ERROR_CODES.MATCH_NOT_ACTIVE);
    return;
  }
  // Найти индекс игрока в config.players по позиции в room
  const playerIdx = room.players.indexOf(conn);
  if (playerIdx < 0) {
    sendErrorWithBudget(conn, ERROR_CODES.NOT_IN_ROOM);
    return;
  }

  const v = room.activeMatch.validateAndQueueDeploy(playerIdx, msg.x, msg.y, msg.tick);
  if (!v.ok) {
    // Day 10: context = координаты rejected deploy, для client prediction rollback.
    const ctx2 = { x: msg.x, y: msg.y, tick: msg.tick };
    if (v.reason === 'Input too old') {
      sendErrorWithBudget(conn, ERROR_CODES.INPUT_TOO_OLD, ctx2);
    } else {
      sendErrorWithBudget(conn, ERROR_CODES.INVALID_DEPLOY, ctx2);
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
 * Используется в leave_room (explicit) + при ws.close() через
 * handleConnectionClose (которая решает grace vs immediate).
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
    // Day 15: empty room → cleanup lobby timer (room полностью исчезает)
    disarmLobbyTimeout(room);
    ctx.rooms.delete(room.code);
  } else {
    // Day 15: <2 players → re-arm lobby timeout (если status=lobby).
    // Это случается когда countdown был cancelled и оппонент ушёл.
    if (room.status === 'lobby') armLobbyTimeout(room, ctx);
    room.broadcast({
      type: 'room_updated',
      players: room.getPlayerInfos(),
    });
  }
}

/**
 * Day 13: обработка ws.close() — split на immediate (lobby/countdown/finished)
 * vs grace (mid-match). В grace mode connection помечается disconnected,
 * остаётся в room.players на slot index, запускается timer на forfeit.
 *
 * Возвращает true если grace mode (connection остался в room),
 * false если был сразу полностью удалён (leaveCurrentRoom path).
 */
export function handleConnectionClose(conn: Connection, ctx: ServerContext): boolean {
  if (!conn.roomCode) return false;
  const room = ctx.rooms.get(conn.roomCode);
  if (!room) {
    conn.roomCode = null;
    return false;
  }

  // Grace path: если идёт активный незаконченный match — даём шанс reconnect.
  if (
    room.activeMatch
    && !room.activeMatch.isFinished
    && room.status === 'playing'
  ) {
    conn.disconnected = true;
    // Broadcast чтобы оппонент увидел "reconnecting..." statusvor
    room.broadcast({
      type: 'room_updated',
      players: room.getPlayerInfos(),
    });
    // Если оба disconnected → cleanup сразу (никто не вернётся)
    if (room.liveCount() === 0) {
      if (room.activeMatch) room.activeMatch.stop();
      room.activeMatch = null;
      ctx.rooms.delete(room.code);
      return false;
    }
    // Запускаем grace timer
    const token = conn.resumeToken;
    const timer = setTimeout(() => {
      room.graceTimers.delete(token);
      // Только если matchstill активен и conn всё ещё disconnected
      if (!room.activeMatch || room.activeMatch.isFinished) return;
      const slot = room.findDisconnectedByToken(token);
      if (!slot) return; // resumed уже
      // Forfeit: оппонент побеждает
      const winnerIdx = slot.idx === 0 ? 1 : 0;
      endActiveMatch(room, 'opponent_disconnected', winnerIdx);
      // Cleanup: убираем dead conn полностью
      room.removePlayer(slot.conn);
      slot.conn.roomCode = null;
      if (room.isEmpty()) {
        ctx.rooms.delete(room.code);
      } else {
        room.broadcast({
          type: 'room_updated',
          players: room.getPlayerInfos(),
        });
      }
    }, ctx.graceDisconnectMs);
    room.graceTimers.set(token, timer);
    return true;
  }

  // Все остальные phase (lobby / countdown / finished) — immediate.
  leaveCurrentRoom(conn, ctx);
  return false;
}
