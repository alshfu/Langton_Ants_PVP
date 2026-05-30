// core/src/protocol/stage8.ts
//
// WebSocket protocol для Stage 8 PvP MVP. Источник: spec §4.2.
// Day 6 Stage 8: переехало из mvp-server/src/messages.ts в @langton/core
// чтобы и frontend (WSClient) и server использовали одни типы.
//
// Все сообщения — JSON (не MessagePack в MVP). Discriminated union по `type`.
// Server возвращает error.locale = клиентский locale из join_room.

import type { SandboxConfig, MatchResult } from '../contract/state.js';
import type { Replay } from '../contract/replay.js';

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
  /** Day 13: true если игрок сейчас отключён (grace period). UI показывает
   *  "Opponent reconnecting..." вместо "Ready". */
  disconnected?: boolean;
}

/** Stage 9.4: информация о зрителе. Только идентификация — UI игрока
 *  показывает "👁 N watching". Spectator не имеет index / ready / disconnected. */
export interface SpectatorInfo {
  clientId: string;
  nickname: string;
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
  | { type: 'join_room';  roomCode: string; nickname: string; locale: string;
      /** Day 13: optional resume token — если client'у выдан токен ранее
       *  (room_joined.resumeToken) и connection теперь reconnect, шлёт его.
       *  Server найдёт matching disconnected slot и восстановит. */
      resumeToken?: string;
      /** Stage 9.2: optional device-id для persistent anonymous identity.
       *  Client сохраняет в localStorage. Server upsert'ит user record
       *  и tracking'ает stats. Если отсутствует — guest без stats. */
      deviceId?: string;
      /** Stage 9.4: если true — присоединиться как spectator (3rd+ connection).
       *  Spectator получает все broadcasts но не может set_ready/deploy/rematch.
       *  Не считается в room.players.length. */
      spectator?: boolean }
  | { type: 'leave_room' }
  | { type: 'set_ready';  ready: boolean }
  | { type: 'deploy';     x: number; y: number; tick: number }
  | { type: 'ping';       t: number }
  /** Day 23: rematch request — после match_ended клиент шлёт это
   *  чтобы выразить намерение сыграть ещё. Server ждёт оба намерения
   *  (60s timeout), затем resetMatch() → room возвращается в lobby. */
  | { type: 'request_rematch' }
  /** Stage 9.1: host задаёт config для матча (только host имеет права).
   *  Partial — server merge'ит с defaultMatchConfig. Server validate'ит
   *  ranges + broadcasts 'room_config_updated' всем в room. */
  | { type: 'set_room_config'; config: PartialMatchConfig }
  /** Stage 9.3: enter matchmaking queue. Server matches с similar-rated
   *  player через expanding window algorithm. */
  | { type: 'find_match'; nickname: string; deviceId?: string }
  /** Stage 9.3: leave queue без match. */
  | { type: 'cancel_matchmaking' }
  /** Stage 9.3: accept bot fallback после long wait. */
  | { type: 'accept_bot_fallback'; difficulty: 'easy' | 'normal' | 'hard' };

/** Stage 9.1: подмножество SandboxConfig которое host может override.
 *  Server валидирует ranges (e.g. width 20..120) и rejects out-of-bounds. */
export interface PartialMatchConfig {
  width?: number;
  height?: number;
  topology?: 'torus' | 'wall' | 'void' | 'bounce';
  winCondition?: { kind: string; threshold?: number; holdTicks?: number };
  baseTps?: number;
  mutationEnabled?: boolean;
}

/** Discriminator-strings, удобно для switch routing. */
export type ClientMessageType = ClientMessage['type'];

// ─── Server → Client ─────────────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'room_joined';    roomCode: string; clientId: string; players: PlayerInfo[];
      /** Day 13: resume token — client персистит для будущего reconnect. */
      resumeToken: string;
      /** Day 13: true если client уже был в этой комнате и просто восстановился. */
      resumed?: boolean;
      /** Stage 9.4: true если this connection — spectator. Client UI hide'ит
       *  Ready/Deploy controls, показывает SPECTATOR badge. */
      asSpectator?: boolean;
      /** Stage 9.4: current spectator list (для UI индикатора). */
      spectators?: SpectatorInfo[] }
  | { type: 'room_updated';   players: PlayerInfo[];
      /** Stage 9.4: список зрителей в room. Players UI показывает "👁 N watching". */
      spectators?: SpectatorInfo[] }
  /** Stage 9.4: новый зритель присоединился. Broadcast всем (players + specs). */
  | { type: 'spectator_joined'; spectators: SpectatorInfo[] }
  /** Stage 9.4: зритель ушёл. clientId — кто вышел. */
  | { type: 'spectator_left';   clientId: string; spectators: SpectatorInfo[] }
  | { type: 'match_resume_state'; matchId: string; tick: number;
      config: SandboxConfig; seed: number;
      deployTimeline: DeployAction[] }
  | { type: 'match_starting'; countdownMs: number; config: SandboxConfig; seed: number; matchId: string }
  | { type: 'match_started';  matchId: string; startedAt: number; serverEngineVersion: string }
  | { type: 'match_tick';     tick: number; deploys: DeployAction[]; checksum?: string }
  | { type: 'match_ended';    result: MatchResult; replayUrl: string;
      /** Day 12: inline replay payload — client может сразу сохранить
       *  в local storage без HTTP fetch (mvp-server WebSocket-only). */
      replay?: Replay }
  | { type: 'pong';           t: number; serverT: number }
  /** Day 23: rematch status — broadcast когда любой игрок просит rematch.
   *  Client показывает "Opponent wants rematch" или "Waiting for opponent". */
  | { type: 'rematch_status'; bothAgreed: boolean;
      /** clientId'ы тех кто уже согласился. Client сравнивает со своим
       *  чтобы понять "я уже согласился" vs "оппонент уже согласился". */
      agreedClientIds: string[] }
  /** Day 23: server reset'нул match — комната снова в lobby, оба игрока
   *  unready. Client сбрасывает phase в 'lobby' и matchResult/scoreboard. */
  | { type: 'rematch_reset' }
  /** Stage 9.1: broadcast когда host задал новый config. Все клиенты в
   *  room update'ят preview. config — полный merged SandboxConfig после
   *  validation. hostClientId — для UI "Only host can change". */
  | { type: 'room_config_updated'; config: SandboxConfig; hostClientId: string }
  /** Stage 9.3: periodic update в queue. waitSec = сколько ждёшь.
   *  queueSize = всего игроков в queue. Optional botFallbackOffered если
   *  >60s wait — client может accept_bot_fallback. */
  | { type: 'matchmaking_status'; waitSec: number; queueSize: number;
      botFallbackOffered?: boolean }
  /** Stage 9.3: match создан. Client navigates на /?room=roomCode. */
  | { type: 'match_found'; roomCode: string; opponentNickname: string }
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
  // Day 13: reconnect
  RESUME_TOKEN_EXPIRED:    'RESUME_TOKEN_EXPIRED',    // grace period истёк
  // Stage 9.1: config selection
  NOT_HOST:                'NOT_HOST',                // set_room_config от non-host
  INVALID_CONFIG:          'INVALID_CONFIG',          // partial config out of ranges
  // Stage 9.4: spectator restrictions
  SPECTATOR_CANT_PLAY:     'SPECTATOR_CANT_PLAY',     // deploy/set_ready/rematch от spectator
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
    case 'request_rematch':
      return true;
    case 'set_room_config':
      return typeof m.config === 'object' && m.config !== null;
    case 'find_match':
      return typeof m.nickname === 'string';
    case 'cancel_matchmaking':
      return true;
    case 'accept_bot_fallback':
      return typeof m.difficulty === 'string';
    default:
      return false;
  }
}
