// tests/room.test.ts
//
// Stage 8 Day 3 — Room class unit tests.

import { describe, it, expect, beforeEach } from 'vitest';
import { Room, ROOM_MAX_PLAYERS } from '../src/room';
import type { ServerMessage } from '../src/messages';

/** Минимальный mock connection для тестов. */
function makeMockConn(id: string, nickname = `Player${id}`): any {
  return {
    clientId: id,
    nickname,
    locale: 'en',
    roomCode: null,
    ready: false,
    closed: false,
    sent: [] as ServerMessage[],
    send(msg: ServerMessage) { this.sent.push(msg); },
    sendError() { /* noop */ },
    setLocale(loc: string) { this.locale = loc; },
    close() { this.closed = true; },
  };
}

describe('Room', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room('abc123');
  });

  it('initial state: empty, status=lobby', () => {
    expect(room.code).toBe('abc123');
    expect(room.players.length).toBe(0);
    expect(room.status).toBe('lobby');
    expect(room.isEmpty()).toBe(true);
    expect(room.allReady()).toBe(false);
  });

  it('addPlayer — добавляет, ставит roomCode на conn', () => {
    const c = makeMockConn('1');
    const ok = room.addPlayer(c);
    expect(ok).toBe(true);
    expect(room.players.length).toBe(1);
    expect(c.roomCode).toBe('abc123');
    expect(c.ready).toBe(false);
  });

  it('addPlayer — отвергает третьего (ROOM_MAX_PLAYERS=2)', () => {
    expect(ROOM_MAX_PLAYERS).toBe(2);
    expect(room.addPlayer(makeMockConn('1'))).toBe(true);
    expect(room.addPlayer(makeMockConn('2'))).toBe(true);
    expect(room.addPlayer(makeMockConn('3'))).toBe(false);
    expect(room.players.length).toBe(2);
  });

  it('addPlayer — idempotent (same conn дважды)', () => {
    const c = makeMockConn('1');
    expect(room.addPlayer(c)).toBe(true);
    expect(room.addPlayer(c)).toBe(true);
    expect(room.players.length).toBe(1);
  });

  it('removePlayer — убирает + clear roomCode + ready', () => {
    const c = makeMockConn('1');
    room.addPlayer(c);
    c.ready = true;
    room.removePlayer(c);
    expect(room.players.length).toBe(0);
    expect(c.roomCode).toBe(null);
    expect(c.ready).toBe(false);
  });

  it('removePlayer — no-op для non-member', () => {
    const c1 = makeMockConn('1');
    const c2 = makeMockConn('2');
    room.addPlayer(c1);
    room.removePlayer(c2); // not in room
    expect(room.players.length).toBe(1);
  });

  it('getPlayerInfos — список с правильными index/nickname/ready', () => {
    const c1 = makeMockConn('1', 'Alice');
    const c2 = makeMockConn('2', 'Bob');
    c1.locale = 'ru';
    room.addPlayer(c1);
    room.addPlayer(c2);
    c2.ready = true;
    const infos = room.getPlayerInfos();
    expect(infos).toEqual([
      { clientId: '1', nickname: 'Alice', index: 0, ready: false, locale: 'ru' },
      { clientId: '2', nickname: 'Bob',   index: 1, ready: true,  locale: 'en' },
    ]);
  });

  it('broadcast — отправляет всем connection.sent', () => {
    const c1 = makeMockConn('1');
    const c2 = makeMockConn('2');
    room.addPlayer(c1);
    room.addPlayer(c2);
    room.broadcast({ type: 'room_updated', players: [] });
    expect(c1.sent).toHaveLength(1);
    expect(c2.sent).toHaveLength(1);
    expect(c1.sent[0].type).toBe('room_updated');
  });

  it('allReady — true только если 2 игрока И оба ready', () => {
    expect(room.allReady()).toBe(false);

    const c1 = makeMockConn('1');
    room.addPlayer(c1);
    c1.ready = true;
    expect(room.allReady()).toBe(false); // 1 player only

    const c2 = makeMockConn('2');
    room.addPlayer(c2);
    expect(room.allReady()).toBe(false); // c2 not ready

    c2.ready = true;
    expect(room.allReady()).toBe(true);

    c1.ready = false;
    expect(room.allReady()).toBe(false);
  });

  it('findPlayer — by clientId', () => {
    const c1 = makeMockConn('aaa');
    const c2 = makeMockConn('bbb');
    room.addPlayer(c1);
    room.addPlayer(c2);
    expect(room.findPlayer('bbb')).toBe(c2);
    expect(room.findPlayer('ccc')).toBeUndefined();
  });
});
