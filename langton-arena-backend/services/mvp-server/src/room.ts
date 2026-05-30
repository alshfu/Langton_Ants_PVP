// src/room.ts
//
// Room — lobby state для 2-player PvP. Stage 8 Day 3.
// Один Room в одно время может содержать 0/1/2 connections.
// status:
//   'lobby'     — ожидаем 2-го игрока ИЛИ оба ещё не Ready
//   'countdown' — оба Ready, идёт 3-2-1 (Day 4)
//   'playing'   — активный матч (Day 4)
//   'finished'  — match закончился (Day 4)

import type { Connection } from './connection.js';
import type { ServerMessage, PlayerInfo, SpectatorInfo } from './messages.js';
import type { Match } from './match.js';

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'finished';

export const ROOM_MAX_PLAYERS = 2;

export class Room {
  readonly code: string;
  readonly createdAt: number;
  readonly players: Connection[] = [];
  status: RoomStatus = 'lobby';
  /** Активный match (Day 4) — null до match_starting countdown completes. */
  activeMatch: Match | null = null;
  /** Handle setTimeout countdown'а — для отмены если игрок ушёл. */
  countdownHandle: NodeJS.Timeout | null = null;
  /** Day 13: grace timers keyed by resumeToken. При disconnect mid-match
   *  ставим таймер — если истёк до resume, forfeit. */
  graceTimers: Map<string, NodeJS.Timeout> = new Map();
  /** Day 15: orphan-lobby timer handle. Armed когда в room <2 live
   *  connections и status='lobby'. Если за `lobbyTimeoutMs` (default 10 мин)
   *  второй player не пришёл — ROOM_TIMEOUT + close room. */
  lobbyTimeoutHandle: NodeJS.Timeout | null = null;
  /** Day 23: clientId'ы кто запросил rematch после match_ended. Когда
   *  size == players.length и status='finished' — resetMatch() и broadcast
   *  rematch_reset. Cleared при reset или timeout. */
  rematchRequests: Set<string> = new Set();
  /** Day 23: timeout handle для rematch. Если за 60s не пришло второе
   *  request_rematch — очищаем set и шлём 'opt_out' notify. */
  rematchTimeoutHandle: NodeJS.Timeout | null = null;
  /** Stage 9.1: host clientId — первый кто joined. Имеет права
   *  set_room_config. На host disconnect → передаётся next player'у. */
  hostClientId: string | null = null;
  /** Stage 9.1: overrides over defaultMatchConfig — apply'ются при
   *  match start. Cleared после rematch_reset (host может set заново). */
  configOverrides: Record<string, unknown> = {};
  /** Stage 9.4: spectator connections. Get все broadcasts (room_updated,
   *  match_tick, etc) но не могут set_ready/deploy/rematch. Не count в
   *  players.length / ROOM_MAX_PLAYERS check. */
  spectators: Connection[] = [];

  constructor(code: string) {
    this.code = code;
    this.createdAt = Date.now();
  }

  /** Добавить connection. Возвращает true если успех, false если room full. */
  addPlayer(conn: Connection): boolean {
    if (this.players.length >= ROOM_MAX_PLAYERS) return false;
    if (this.players.includes(conn)) return true; // idempotent
    this.players.push(conn);
    conn.roomCode = this.code;
    conn.ready = false;
    // Stage 9.1: first player becomes host
    if (this.hostClientId == null) {
      this.hostClientId = conn.clientId;
    }
    return true;
  }

  /** Убрать connection из room. */
  removePlayer(conn: Connection): void {
    const idx = this.players.indexOf(conn);
    if (idx < 0) return;
    this.players.splice(idx, 1);
    if (conn.roomCode === this.code) {
      conn.roomCode = null;
      conn.ready = false;
    }
    // Stage 9.1: host disconnect → передаём next player'у
    if (this.hostClientId === conn.clientId) {
      this.hostClientId = this.players[0]?.clientId ?? null;
    }
  }

  /** Snapshot всех игроков для room_updated broadcast.
   *  Day 13: disconnected exposed чтобы UI оппонента показывал статус. */
  getPlayerInfos(): PlayerInfo[] {
    return this.players.map((conn, index) => ({
      clientId: conn.clientId,
      nickname: conn.nickname,
      index,
      ready: conn.ready,
      locale: conn.locale,
      ...(conn.disconnected ? { disconnected: true } : {}),
    }));
  }

  /** Stage 9.4: snapshot зрителей для broadcast. */
  getSpectatorInfos(): SpectatorInfo[] {
    return this.spectators.map((conn) => ({
      clientId: conn.clientId,
      nickname: conn.nickname,
      locale: conn.locale,
    }));
  }

  /** Stage 9.4: добавить зрителя. Идемпотентно. */
  addSpectator(conn: Connection): void {
    if (this.spectators.includes(conn)) return;
    this.spectators.push(conn);
    conn.roomCode = this.code;
  }

  /** Stage 9.4: убрать зрителя. */
  removeSpectator(conn: Connection): void {
    const idx = this.spectators.indexOf(conn);
    if (idx < 0) return;
    this.spectators.splice(idx, 1);
    if (conn.roomCode === this.code) conn.roomCode = null;
  }

  /** Stage 9.4: проверка — connection это spectator в этой room. */
  isSpectator(conn: Connection): boolean {
    return this.spectators.includes(conn);
  }

  /** Отправить message ВСЕМ игрокам И зрителям в room.
   *  Day 13: пропускаем disconnected — у них ws закрыт, send no-op.
   *  Stage 9.4: spectators получают full broadcast tap. */
  broadcast(msg: ServerMessage): void {
    for (const conn of this.players) {
      if (conn.disconnected) continue;
      conn.send(msg);
    }
    for (const conn of this.spectators) {
      conn.send(msg);
    }
  }

  /** Готовы ли все (≥1) игроки. Используется в Day 4 для match_starting.
   *  Day 13: disconnected игроки не считаются ready. */
  allReady(): boolean {
    if (this.players.length < ROOM_MAX_PLAYERS) return false;
    return this.players.every((p) => p.ready && !p.disconnected);
  }

  /** Пуста ли комната — для cleanup в RoomManager.
   *  Day 13: disconnected counted как occupied (resume может прийти).
   *  Stage 9.4: spectators alone не keep room alive — если все players ушли,
   *  room удаляется даже если specs ещё подключены (specs disconnect автоматом). */
  isEmpty(): boolean {
    return this.players.length === 0;
  }

  /** Day 13: число активных (не disconnected) connections. */
  liveCount(): number {
    return this.players.filter((c) => !c.disconnected).length;
  }

  /** Day 13: найти disconnected slot по resumeToken. */
  findDisconnectedByToken(token: string): { conn: Connection; idx: number } | null {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]!;
      if (p.disconnected && p.resumeToken === token) return { conn: p, idx: i };
    }
    return null;
  }

  /** Найти player по clientId — для адресных messages. */
  findPlayer(clientId: string): Connection | undefined {
    return this.players.find((c) => c.clientId === clientId);
  }
}
