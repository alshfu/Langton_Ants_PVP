// tests/matchmaker.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Matchmaker } from '../src/matchmaker.js';
import { NoOpPersistence } from '../src/persistence.js';
import { RoomManager } from '../src/roomManager.js';
import type { Connection } from '../src/connection.js';
import type { ServerMessage } from '../src/messages.js';

// Mock Connection
function mockConn(clientId: string, userId: string | null = null): Connection {
  const sent: ServerMessage[] = [];
  return {
    clientId,
    nickname: clientId,
    userId,
    closed: false,
    disconnected: false,
    send: (msg: ServerMessage) => { sent.push(msg); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get sent() { return sent; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('Matchmaker', () => {
  let mm: Matchmaker;
  let rooms: RoomManager;
  let persistence: NoOpPersistence;

  beforeEach(() => {
    rooms = new RoomManager();
    persistence = new NoOpPersistence();
    mm = new Matchmaker(rooms, persistence);
  });

  it('enqueue adds to queue', async () => {
    const a = mockConn('a');
    await mm.enqueue(a, 'Alice');
    expect(mm.size()).toBe(1);
    expect(mm.has(a)).toBe(true);
  });

  it('enqueue идемпотентно', async () => {
    const a = mockConn('a');
    await mm.enqueue(a, 'Alice');
    await mm.enqueue(a, 'Alice');
    expect(mm.size()).toBe(1);
  });

  it('dequeue removes from queue', async () => {
    const a = mockConn('a');
    await mm.enqueue(a, 'Alice');
    expect(mm.dequeue(a)).toBe(true);
    expect(mm.size()).toBe(0);
  });

  it('sweep pairs entries в window', async () => {
    const a = mockConn('a');
    const b = mockConn('b');
    await mm.enqueue(a, 'Alice');
    await mm.enqueue(b, 'Bob');
    // Force sweep
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mm as any).sweep();
    // Both should be removed from queue + receive match_found
    expect(mm.size()).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aSent = (a as any).sent as ServerMessage[];
    expect(aSent.some((m) => m.type === 'match_found')).toBe(true);
  });

  it('does NOT pair entries вне rating window', async () => {
    const a = mockConn('a');
    const b = mockConn('b');
    // a rating 1500 default, b also 1500 — within window
    // Override: спам persistence для разных rating'ов
    persistence.getUserStats = vi.fn(async (id: string) => {
      if (id === 'a-user') return { id, deviceId: 'd', nickname: 'A', createdAt: 0, lastActive: 0,
        totalMatches: 0, wins: 0, losses: 0, draws: 0, rating: 1000 };
      if (id === 'b-user') return { id, deviceId: 'd', nickname: 'B', createdAt: 0, lastActive: 0,
        totalMatches: 0, wins: 0, losses: 0, draws: 0, rating: 2000 };
      return null;
    });
    a.userId = 'a-user';
    b.userId = 'b-user';
    await mm.enqueue(a, 'Alice');
    await mm.enqueue(b, 'Bob');
    // Just joined — window = 50 → не должны pair при rating diff 1000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mm as any).sweep();
    expect(mm.size()).toBe(2);
  });

  it('skips dead connections (closed)', async () => {
    const a = mockConn('a');
    a.closed = true;
    const b = mockConn('b');
    await mm.enqueue(a, 'Alice');
    await mm.enqueue(b, 'Bob');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mm as any).sweep();
    // a dropped from queue, b alone — no pair
    expect(mm.size()).toBe(1);
    expect(mm.has(b)).toBe(true);
  });

  it('broadcastStatus отправляет matchmaking_status', async () => {
    const a = mockConn('a');
    await mm.enqueue(a, 'Alice');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mm as any).broadcastStatus();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (a as any).sent as ServerMessage[];
    const status = sent.find((m) => m.type === 'matchmaking_status');
    expect(status).toBeDefined();
    if (status?.type === 'matchmaking_status') {
      expect(status.queueSize).toBe(1);
      expect(status.botFallbackOffered).toBeFalsy();
    }
  });

  it('start/stop не падает на multiple calls', () => {
    expect(() => mm.start()).not.toThrow();
    expect(() => mm.start()).not.toThrow(); // idempotent
    expect(() => mm.stop()).not.toThrow();
    expect(() => mm.stop()).not.toThrow();
  });
});
