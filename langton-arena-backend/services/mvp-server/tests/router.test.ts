// tests/router.test.ts
//
// Stage 8 Day 2 — message routing: parse, validate, dispatch.
// Используется fake Connection чтобы не поднимать real WS.

import { describe, it, expect, beforeEach } from 'vitest';
import { routeMessage } from '../src/router';
import { ERROR_CODES, type ServerMessage } from '../src/messages';

/** Минимальный mock Connection — собирает sent messages в массив. */
class MockConnection {
  clientId = 'mock-client';
  locale: string = 'en';
  roomCode: string | null = null;
  closed = false;
  sent: ServerMessage[] = [];

  send(msg: ServerMessage): void { this.sent.push(msg); }
  sendError(code: string): void {
    this.sent.push({
      type: 'error',
      code,
      message: `error: ${code}`,
      locale: this.locale,
    });
  }
  setLocale(loc: string): void { this.locale = loc; }
  close(): void { this.closed = true; }
}

describe('router.routeMessage', () => {
  let conn: MockConnection;

  beforeEach(() => { conn = new MockConnection(); });

  it('возвращает MALFORMED_MESSAGE на invalid JSON', () => {
    routeMessage(conn as any, 'not-a-json{');
    expect(conn.sent).toHaveLength(1);
    expect(conn.sent[0]!).toMatchObject({
      type: 'error',
      code: ERROR_CODES.MALFORMED_MESSAGE,
    });
  });

  it('возвращает MALFORMED_MESSAGE если нет type field', () => {
    routeMessage(conn as any, JSON.stringify({ foo: 'bar' }));
    expect(conn.sent[0]!.type).toBe('error');
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.MALFORMED_MESSAGE);
  });

  it('возвращает UNKNOWN_MESSAGE_TYPE для unrecognized type', () => {
    routeMessage(conn as any, JSON.stringify({ type: 'evil_hack' }));
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
  });

  it('ping → pong с теми же t + serverT', () => {
    const t0 = 1234567890;
    routeMessage(conn as any, JSON.stringify({ type: 'ping', t: t0 }));
    expect(conn.sent).toHaveLength(1);
    const pong = conn.sent[0] as any;
    expect(pong.type).toBe('pong');
    expect(pong.t).toBe(t0);
    expect(typeof pong.serverT).toBe('number');
  });

  it('join_room → room_joined + устанавливает roomCode + locale', () => {
    routeMessage(conn as any, JSON.stringify({
      type: 'join_room',
      roomCode: 'abc123',
      nickname: 'BraveAnt',
      locale: 'ru',
    }));
    expect(conn.locale).toBe('ru');
    expect(conn.roomCode).toBe('abc123');
    expect(conn.sent).toHaveLength(1);
    const reply = conn.sent[0] as any;
    expect(reply.type).toBe('room_joined');
    expect(reply.roomCode).toBe('abc123');
    expect(reply.clientId).toBe('mock-client');
    expect(reply.players).toEqual([]);
  });

  it('set_ready до join → NOT_IN_ROOM', () => {
    routeMessage(conn as any, JSON.stringify({ type: 'set_ready', ready: true }));
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.NOT_IN_ROOM);
  });

  it('deploy до join → NOT_IN_ROOM', () => {
    routeMessage(conn as any, JSON.stringify({ type: 'deploy', x: 5, y: 5, tick: 1 }));
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.NOT_IN_ROOM);
  });

  it('deploy внутри room (stub) → MATCH_NOT_ACTIVE', () => {
    conn.roomCode = 'abc';
    routeMessage(conn as any, JSON.stringify({ type: 'deploy', x: 5, y: 5, tick: 1 }));
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.MATCH_NOT_ACTIVE);
  });

  it('leave_room обнуляет roomCode (даже без error)', () => {
    conn.roomCode = 'abc';
    routeMessage(conn as any, JSON.stringify({ type: 'leave_room' }));
    expect(conn.roomCode).toBe(null);
    expect(conn.sent).toEqual([]);
  });

  it('валидация shape: join_room без nickname → MALFORMED', () => {
    routeMessage(conn as any, JSON.stringify({
      type: 'join_room',
      roomCode: 'abc',
      locale: 'en',
      // missing nickname
    }));
    // isClientMessage возвращает false → попадаем в "есть type, но shape невалидный"
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
  });

  it('валидация shape: ping без t → UNKNOWN_MESSAGE_TYPE', () => {
    routeMessage(conn as any, JSON.stringify({ type: 'ping' }));
    expect((conn.sent[0] as any).code).toBe(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
  });
});
