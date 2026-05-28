// core/src/protocol/stage8.ts
//
// WebSocket protocol для Stage 8 PvP MVP. Источник: spec §4.2.
// Day 6 Stage 8: переехало из mvp-server/src/messages.ts в @langton/core
// чтобы и frontend (WSClient) и server использовали одни типы.
//
// Все сообщения — JSON (не MessagePack в MVP). Discriminated union по `type`.
// Server возвращает error.locale = клиентский locale из join_room.

import type { SandboxConfig, MatchResult } from '../contract/state.js';

// ─── Reused types ────────────────────────────────────────────────────────────

/** Информация об игроке в lobby/match. */
export interface PlayerInfo {
  clientId: string;
  nickname: string;
  /** Индекс игрока в Room (0 или 1 в MVP — 2 player max). */
  index: number;
  ready: boolean;
  /** Локаль игрока для error messages. */
  locale: string;
}

/** Атомарное действие deploy в match. */
export interface DeployAction {
  tick: number;
  playerIdx: number;
  x: number;
  y: number;
}

// ─── Client → Server ─────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'join_room';  roomCode: string; nickname: string; locale: string }
  | { type: 'leave_room' }
  | { type: 'set_ready';  ready: boolean }
  | { type: 'deploy';     x: number; y: number; tick: number }
  | { type: 'ping';       t: number };

/** Discriminator-strings, удобно для switch routing. */
export type ClientMessageType = ClientMessage['type'];

// ─── Server → Client ─────────────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'room_joined';    roomCode: string; clientId: string; players: PlayerInfo[] }
  | { type: 'room_updated';   players: PlayerInfo[] }
  | { type: 'match_starting'; countdownMs: number; config: SandboxConfig; seed: number; matchId: string }
  | { type: 'match_started';  matchId: string; startedAt: number; serverEngineVersion: string }
  | { type: 'match_tick';     tick: number; deploys: DeployAction[]; checksum?: string }
  | { type: 'match_ended';    result: MatchResult; replayUrl: string }
  | { type: 'pong';           t: number; serverT: number }
  | { type: 'error';          code: string; message: string; locale: string;
      /** Day 10: контекст rejected действия — для client-side prediction
       *  reconciliation. Опционально, заполняется только когда есть смысл
       *  (INVALID_DEPLOY/INPUT_TOO_OLD → координаты + tick). */
      context?: { x?: number; y?: number; tick?: number } };

export type ServerMessageType = ServerMessage['type'];

// ─── Error codes ─────────────────────────────────────────────────────────────
// Коды используются и в server-internal logic, и в i18n.ts для lookup.
// Любое новое error message → добавить код сюда + перевод в i18n.ts.

export const ERROR_CODES = {
  // Connection / routing
  MALFORMED_MESSAGE:       'MALFORMED_MESSAGE',       // не валидный JSON или missing type
  UNKNOWN_MESSAGE_TYPE:    'UNKNOWN_MESSAGE_TYPE',    // type не входит в ClientMessage
  RATE_LIMIT_EXCEEDED:     'RATE_LIMIT_EXCEEDED',     // > 5 deploys/sec (Day 17)

  // Room
  ROOM_FULL:               'ROOM_FULL',               // 2 players already
  ROOM_TIMEOUT:            'ROOM_TIMEOUT',            // ждали Player B 5 минут
  ROOM_NOT_FOUND:          'ROOM_NOT_FOUND',          // join_room после close
  NOT_IN_ROOM:             'NOT_IN_ROOM',             // set_ready/deploy без join_room

  // Match
  MATCH_NOT_ACTIVE:        'MATCH_NOT_ACTIVE',        // deploy в lobby
  INVALID_DEPLOY:          'INVALID_DEPLOY',          // canDeploy() = false
  INPUT_TOO_OLD:           'INPUT_TOO_OLD',           // deploy с tick < server.tick
  FIELD_TOO_LARGE_FOR_PVP: 'FIELD_TOO_LARGE_FOR_PVP', // > 200×200
  ENGINE_VERSION_MISMATCH: 'ENGINE_VERSION_MISMATCH', // client engine ≠ server
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ─── Type guards ─────────────────────────────────────────────────────────────

/** Безопасная проверка что object — ClientMessage. */
export function isClientMessage(obj: unknown): obj is ClientMessage {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj as Record<string, unknown>;
  if (typeof m.type !== 'string') return false;
  // Минимальная shape-валидация per type. Глубокая — в handler'ах.
  switch (m.type) {
    case 'join_room':
      return typeof m.roomCode === 'string'
          && typeof m.nickname === 'string'
          && typeof m.locale === 'string';
    case 'leave_room':
      return true;
    case 'set_ready':
      return typeof m.ready === 'boolean';
    case 'deploy':
      return typeof m.x === 'number'
          && typeof m.y === 'number'
          && typeof m.tick === 'number';
    case 'ping':
      return typeof m.t === 'number';
    default:
      return false;
  }
}
