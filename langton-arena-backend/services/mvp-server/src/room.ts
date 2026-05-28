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

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'finished';

export const ROOM_MAX_PLAYERS = 2;

export class Room {
  readonly code: string;
  readonly createdAt: number;
  readonly players: Connection[] = [];
  status: RoomStatus = 'lobby';

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

  /** Snapshot всех игроков для room_updated broadcast. */
  getPlayerInfos(): PlayerInfo[] {
    return this.players.map((conn, index) => ({
      clientId: conn.clientId,
      nickname: conn.nickname,
      index,
      ready: conn.ready,
      locale: conn.locale,
    }));
  }

  /** Отправить message ВСЕМ игрокам в room. */
  broadcast(msg: ServerMessage): void {
    for (const conn of this.players) {
      conn.send(msg);
    }
  }

  /** Готовы ли все (≥1) игроки. Используется в Day 4 для match_starting. */
  allReady(): boolean {
    if (this.players.length < ROOM_MAX_PLAYERS) return false;
    return this.players.every((p) => p.ready);
  }

  /** Пуста ли комната — для cleanup в RoomManager. */
  isEmpty(): boolean {
    return this.players.length === 0;
  }

  /** Найти player по clientId — для адресных messages. */
  findPlayer(clientId: string): Connection | undefined {
    return this.players.find((c) => c.clientId === clientId);
  }
}
