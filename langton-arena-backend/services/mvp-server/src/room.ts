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
import type { ServerMessage, PlayerInfo } from './messages.js';
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

  /** Отправить message ВСЕМ игрокам в room.
   *  Day 13: пропускаем disconnected — у них ws закрыт, send no-op. */
  broadcast(msg: ServerMessage): void {
    for (const conn of this.players) {
      if (conn.disconnected) continue;
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
   *  Day 13: disconnected counted как occupied (resume может прийти). */
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
