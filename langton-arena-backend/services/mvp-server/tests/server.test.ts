// tests/server.test.ts
//
// Stage 8 Day 2 + Day 3 — integration tests с реальным WebSocket клиентом.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { MvpServer } from '../src/server';
import type { ServerMessage } from '../src/messages';

/**
 * Inbox — собирает все incoming WS messages в очередь.
 * Решает race condition: ws.once может пропустить burst-сообщения когда
 * listener ещё не привязан.
 */
class Inbox {
  msgs: ServerMessage[] = [];
  private resolvers: Array<{ resolve: (m: ServerMessage) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];

  push(m: ServerMessage): void {
    const pending = this.resolvers.shift();
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(m);
    } else {
      this.msgs.push(m);
    }
  }

  next(timeoutMs = 2000): Promise<ServerMessage> {
    if (this.msgs.length > 0) return Promise.resolve(this.msgs.shift()!);
    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.resolvers.findIndex((r) => r.timer === timer);
        if (idx >= 0) this.resolvers.splice(idx, 1);
        reject(new Error('timeout waiting for message'));
      }, timeoutMs);
      this.resolvers.push({ resolve, reject, timer });
    });
  }

  /** Прочитать N сообщений подряд. */
  async readN(n: number): Promise<ServerMessage[]> {
    const out: ServerMessage[] = [];
    for (let i = 0; i < n; i++) out.push(await this.next());
    return out;
  }

  /** Дождаться message с матчингом по predicate (drops messages until match). */
  async waitFor(pred: (m: ServerMessage) => boolean, timeoutMs = 2000): Promise<ServerMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const m = await this.next(Math.max(50, deadline - Date.now()));
      if (pred(m)) return m;
    }
    throw new Error('timeout waiting for predicate match');
  }
}

async function openClient(url: string): Promise<{ ws: WebSocket; inbox: Inbox }> {
  const ws = new WebSocket(url);
  const inbox = new Inbox();
  ws.on('message', (data) => {
    try {
      inbox.push(JSON.parse(data.toString('utf8')));
    } catch { /* swallow malformed */ }
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return { ws, inbox };
}

describe('MvpServer integration', () => {
  let server: MvpServer;
  let url: string;

  beforeEach(async () => {
    server = new MvpServer({ port: 0, logger: () => { /* silent */ } });
    const { host, port } = await server.start();
    url = `ws://${host}:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  const joinMsg = (room: string, nick: string, locale = 'en') =>
    JSON.stringify({ type: 'join_room', roomCode: room, nickname: nick, locale });

  // ─── Базовые (Day 2) ───────────────────────────────────────────────────────

  it('server accepts connection + tracks count', async () => {
    const { ws } = await openClient(url);
    expect(server.connectionCount).toBe(1);
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(server.connectionCount).toBe(0);
  });

  it('ping → pong round-trip', async () => {
    const { ws, inbox } = await openClient(url);
    ws.send(JSON.stringify({ type: 'ping', t: 999 }));
    const msg = await inbox.next();
    expect(msg.type).toBe('pong');
    ws.close();
  });

  it('invalid JSON → error MALFORMED_MESSAGE', async () => {
    const { ws, inbox } = await openClient(url);
    ws.send('not-json{');
    const msg = await inbox.next();
    expect(msg.type).toBe('error');
    expect((msg as any).code).toBe('MALFORMED_MESSAGE');
    ws.close();
  });

  it('error message локализован (ru)', async () => {
    const { ws, inbox } = await openClient(url);
    ws.send(joinMsg('x', 'A', 'ru'));
    await inbox.readN(2); // room_joined + room_updated
    ws.send(JSON.stringify({ type: 'deploy', x: 0, y: 0, tick: 0 }));
    const err = await inbox.next();
    expect(err.type).toBe('error');
    expect((err as any).locale).toBe('ru');
    expect((err as any).message).toContain('Матч');
    ws.close();
  });

  // ─── Day 3 — Room flow ────────────────────────────────────────────────────

  it('two clients join same room → оба видят друг друга', async () => {
    const a = await openClient(url);
    a.ws.send(joinMsg('shared', 'Alice'));
    const ackA = await a.inbox.next();          // room_joined
    expect(ackA.type).toBe('room_joined');
    await a.inbox.next();                        // room_updated (only A)

    const b = await openClient(url);
    b.ws.send(joinMsg('shared', 'Bob'));
    const ackB = await b.inbox.next();
    expect(ackB.type).toBe('room_joined');
    expect((ackB as any).players).toHaveLength(2);

    // A получает room_updated после прихода B
    const updA = await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);
    expect((updA as any).players[0].nickname).toBe('Alice');
    expect((updA as any).players[1].nickname).toBe('Bob');

    a.ws.close();
    b.ws.close();
  });

  it('третий → ROOM_FULL', async () => {
    const a = await openClient(url);
    const b = await openClient(url);
    const c = await openClient(url);

    a.ws.send(joinMsg('r', 'A')); await a.inbox.readN(2);
    b.ws.send(joinMsg('r', 'B')); await b.inbox.readN(2);
    c.ws.send(joinMsg('r', 'C'));
    const errC = await c.inbox.waitFor((m) => m.type === 'error');
    expect((errC as any).code).toBe('ROOM_FULL');

    a.ws.close(); b.ws.close(); c.ws.close();
  });

  it('set_ready broadcasts другому игроку', async () => {
    const a = await openClient(url);
    const b = await openClient(url);
    a.ws.send(joinMsg('r', 'A')); await a.inbox.readN(2);
    b.ws.send(joinMsg('r', 'B')); await b.inbox.readN(2);
    await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);

    a.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    const updA = await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.find((p: any) => p.nickname === 'A')?.ready === true);
    const updB = await b.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.find((p: any) => p.nickname === 'A')?.ready === true);
    expect((updA as any).players.find((p: any) => p.nickname === 'A').ready).toBe(true);
    expect((updB as any).players.find((p: any) => p.nickname === 'B').ready).toBe(false);

    a.ws.close(); b.ws.close();
  });

  it('disconnect → партнёр получает room_updated с 1 игроком', async () => {
    const a = await openClient(url);
    const b = await openClient(url);
    a.ws.send(joinMsg('r', 'A')); await a.inbox.readN(2);
    b.ws.send(joinMsg('r', 'B')); await b.inbox.readN(2);
    await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);

    a.ws.close();
    const updB = await b.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 1);
    expect((updB as any).players[0].nickname).toBe('B');

    // RoomManager всё ещё хранит room (B остался)
    expect(server.rooms.size).toBe(1);

    b.ws.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(server.rooms.size).toBe(0);
  });

  it('leave_room → cleanup', async () => {
    const { ws, inbox } = await openClient(url);
    ws.send(joinMsg('r', 'A'));
    await inbox.readN(2);
    expect(server.rooms.size).toBe(1);

    ws.send(JSON.stringify({ type: 'leave_room' }));
    await new Promise((r) => setTimeout(r, 80));
    expect(server.rooms.size).toBe(0);
    ws.close();
  });

  it('server.stop() closes all connections', async () => {
    const a = await openClient(url);
    const b = await openClient(url);
    expect(server.connectionCount).toBe(2);
    const closePromiseA = new Promise<void>((res) => a.ws.once('close', () => res()));
    const closePromiseB = new Promise<void>((res) => b.ws.once('close', () => res()));
    await server.stop();
    await Promise.all([closePromiseA, closePromiseB]);
    expect(server.connectionCount).toBe(0);
  });
});
