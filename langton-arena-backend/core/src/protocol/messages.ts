// core/src/protocol/messages.ts
//
// Полный список сообщений WebSocket-протокола.
// Соответствие: docs/backend-architecture.md §4.3 и interface-contract.md §5.
//
// Принципы:
//   1. Каждое сообщение имеет фиксированный type (строка с двоеточием-namespace).
//   2. seq — порядковый номер сообщения (для упорядоченности при reconnect).
//   3. ts — server timestamp в мс (для измерения latency).
//   4. payload — типизированные данные конкретного сообщения.
//
// Все сообщения сериализуются через MessagePack (codec.ts).

import type { Vector2 } from '../contract/state';

/** Базовая обёртка любого WS-сообщения. */
export interface WsMessage<T extends string = string, P = unknown> {
  type: T;
  seq: number;
  ts: number;
  payload: P;
}

// ═════════════════════════════════════════════════════════════════════════════
// Клиент → Сервер
// ═════════════════════════════════════════════════════════════════════════════

/** Первое сообщение после WebSocket connect. Передаёт JWT для аутентификации. */
export type C2S_AuthHello = WsMessage<'auth:hello', { token: string }>;

/** Вступить в очередь матчмейкинга. */
export type C2S_MmJoin = WsMessage<'mm:join', {
  mode: 'arena' | 'arena_ranked' | 'arena_team' | 'private';
  options?: {
    preferredPlayerCount?: 2 | 4 | 6 | 8 | 10;
    inviteCode?: string;       // для private lobby
  };
}>;

/** Покинуть очередь. */
export type C2S_MmLeave = WsMessage<'mm:leave', Record<string, never>>;

/** Принять найденный матч (после mm:match_found). */
export type C2S_MmAccept = WsMessage<'mm:accept', { matchId: string }>;

/** Отметить готовность в лобби. */
export type C2S_LobbyReady = WsMessage<'lobby:ready', { lobbyId: string }>;

/** Сменить правило конкретного муравья. */
export type C2S_LobbySquadChange = WsMessage<'lobby:squad_change', {
  lobbyId: string;
  antIndex: number;          // 0..4
  ruleId: string;            // 'classic' | 'spiral' | ...
}>;

/** Текстовое сообщение в чат лобби. */
export type C2S_LobbyChat = WsMessage<'lobby:chat', { lobbyId: string; text: string }>;

/** Быстрая эмоция в лобби. */
export type C2S_LobbyQuickChat = WsMessage<'lobby:quick_chat', { lobbyId: string; emoteId: string }>;

/** Вход в матч / reconnect. lastSeq = последний полученный seq для частичного догона. */
export type C2S_MatchHello = WsMessage<'match:hello', { matchId: string; lastSeq?: number }>;

/** Выбрать муравья (для фокуса камеры). */
export type C2S_MatchSelectAnt = WsMessage<'match:select_ant', { matchId: string; antId: string }>;

/** Эмоция в матче. */
export type C2S_MatchEmote = WsMessage<'match:emote', { matchId: string; emoteId: string }>;

/** Сдаться. */
export type C2S_MatchForfeit = WsMessage<'match:forfeit', { matchId: string }>;

/** Пинг для измерения латентности. */
export type C2S_Ping = WsMessage<'ping', Record<string, never>>;

/** Объединение всех клиент→сервер сообщений. */
export type ClientToServer =
  | C2S_AuthHello
  | C2S_MmJoin
  | C2S_MmLeave
  | C2S_MmAccept
  | C2S_LobbyReady
  | C2S_LobbySquadChange
  | C2S_LobbyChat
  | C2S_LobbyQuickChat
  | C2S_MatchHello
  | C2S_MatchSelectAnt
  | C2S_MatchEmote
  | C2S_MatchForfeit
  | C2S_Ping;

// ═════════════════════════════════════════════════════════════════════════════
// Сервер → Клиент
// ═════════════════════════════════════════════════════════════════════════════

/** Успешная аутентификация. */
export type S2C_AuthOk = WsMessage<'auth:ok', {
  userId: string;
  regions: string[];
  wsId: string;
}>;

/** Ошибка аутентификации. */
export type S2C_AuthError = WsMessage<'auth:error', { code: string; message: string }>;

/** Обновление состояния очереди. */
export type S2C_MmQueueUpdate = WsMessage<'mm:queue_update', {
  found: number;
  target: number;
  etaMs: number;
  slots: Array<{ index: number; state: 'empty' | 'filling' | 'filled' }>;
}>;

/** Матч найден, ожидаем accept. */
export type S2C_MmMatchFound = WsMessage<'mm:match_found', {
  matchId: string;
  lobbyId: string;
  players: Array<{ playerId: string; username: string; sr: number }>;
  acceptDeadline: number;     // unix ms
}>;

/** Матчмейкинг отменён. */
export type S2C_MmCancelled = WsMessage<'mm:cancelled', { reason: string }>;

/** Полное состояние лобби (отправляется при каждом изменении). */
export type S2C_LobbyState = WsMessage<'lobby:state', {
  lobbyState: import('../contract/state').LobbyState;
}>;

/** Сообщение чата получено. */
export type S2C_LobbyChat = WsMessage<'lobby:chat', {
  from: string;
  username: string;
  text: string;
  ts: number;
}>;

/** Старт обратного отсчёта. */
export type S2C_LobbyStartCountdown = WsMessage<'lobby:start_countdown', {
  startsAt: number;           // unix ms
}>;

/** Начало матча. */
export type S2C_MatchStart = WsMessage<'match:start', {
  matchId: string;
  initialState: import('../contract/state').MatchState;
  seed: number;
  startsAt: number;
}>;

/** Тик матча (дельта состояния). См. backend §4.4. */
export type S2C_MatchTick = WsMessage<'match:tick', {
  matchId: string;
  tick: number;
  cells?: Array<{ x: number; y: number; owner: number; state: number }>;
  ants?: Array<{
    id: string;
    x?: number;
    y?: number;
    dir?: 0 | 1 | 2 | 3;
    hp?: number;
    dead?: boolean;
    lastDamageTick?: number;
  }>;
  scores?: Record<string, { cells: number; pct: number; alive: number }>;
  eventRefs?: number[];       // seq'ы match:event сообщений в этом тике
}>;

/** Игровое событие (для UI: всплески, звуки, фиды). */
export type S2C_MatchEvent = WsMessage<'match:event', import('../contract/events').MatchEvent>;

/** Один из игроков отвалился. */
export type S2C_MatchPlayerDc = WsMessage<'match:player_dc', { playerId: string }>;

/** Игрок вернулся. */
export type S2C_MatchPlayerReconnect = WsMessage<'match:player_reconnect', { playerId: string }>;

/** Конец матча. */
export type S2C_MatchEnd = WsMessage<'match:end', {
  winnerId: string | null;
  scores: Record<string, { cells: number; pct: number; place: number }>;
  reason: 'time_up' | 'last_standing' | 'forfeit';
}>;

/** Системное уведомление. */
export type S2C_Notification = WsMessage<'notification', {
  type: string;
  payload: unknown;
}>;

/** Ответ на ping. */
export type S2C_Pong = WsMessage<'pong', Record<string, never>>;

/** Ошибка обработки клиентского сообщения. */
export type S2C_Error = WsMessage<'error', { code: string; message: string; refSeq?: number }>;

/** Объединение всех сервер→клиент сообщений. */
export type ServerToClient =
  | S2C_AuthOk
  | S2C_AuthError
  | S2C_MmQueueUpdate
  | S2C_MmMatchFound
  | S2C_MmCancelled
  | S2C_LobbyState
  | S2C_LobbyChat
  | S2C_LobbyStartCountdown
  | S2C_MatchStart
  | S2C_MatchTick
  | S2C_MatchEvent
  | S2C_MatchPlayerDc
  | S2C_MatchPlayerReconnect
  | S2C_MatchEnd
  | S2C_Notification
  | S2C_Pong
  | S2C_Error;

// ═════════════════════════════════════════════════════════════════════════════
// Кодек (encode/decode через MessagePack)
// ═════════════════════════════════════════════════════════════════════════════
// Реализация — в codec.ts. Здесь re-export для удобства потребителей.

export { encodeMessage, decodeMessage } from './codec';

// Unused import suppression
void ({} as Vector2);
