// tests/server.test.ts
//
// Stage 8 Day 2 — integration tests с реальным WebSocket клиентом.
// Поднимаем MvpServer на random port (port:0), коннектимся, шлём, проверяем.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { MvpServer } from '../src/server';
import type { ServerMessage } from '../src/messages';

/** Helper — открыть WS клиент, дождаться 'open'. */
async function openClient(url: string): Promise<WebSocket> {
  const ws = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return ws;
}

/** Helper — следующее сообщение от сервера, parsed JSON. */
function nextMessage(ws: WebSocket, timeoutMs = 2000): Promise<ServerMessage> {
  return new Promise<ServerMessage>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
  });
}

describe('MvpServer integration', () => {
  let server: MvpServer;
  let url: string;

  beforeEach(async () => {
    server = new MvpServer({ port: 0, logger: () => { /* silent in tests */ } });
    const { host, port } = await server.start();
    url = `ws://${host}:${port}`;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('server starts on random port and accepts connection', async () => {
    const ws = await openClient(url);
    expect(server.connectionCount).toBe(1);
    ws.close();
    // Wait a tick for server-side onclose
    await new Promise((r) => setTimeout(r, 100));
    expect(server.connectionCount).toBe(0);
  });

  it('ping → pong round-trip', async () => {
    const ws = await openClient(url);
    const t0 = 999_999;
    ws.send(JSON.stringify({ type: 'ping', t: t0 }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('pong');
    expect((msg as any).t).toBe(t0);
    expect(typeof (msg as any).serverT).toBe('number');
    ws.close();
  });

  it('invalid JSON → error MALFORMED_MESSAGE', async () => {
    const ws = await openClient(url);
    ws.send('not-json{');
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('error');
    expect((msg as any).code).toBe('MALFORMED_MESSAGE');
    ws.close();
  });

  it('join_room → room_joined acknowledgment', async () => {
    const ws = await openClient(url);
    ws.send(JSON.stringify({
      type: 'join_room',
      roomCode: 'abc123',
      nickname: 'TestAnt',
      locale: 'en',
    }));
    const msg = await nextMessage(ws);
    expect(msg.type).toBe('room_joined');
    expect((msg as any).roomCode).toBe('abc123');
    expect(typeof (msg as any).clientId).toBe('string');
    ws.close();
  });

  it('multiple concurrent clients tracked independently', async () => {
    const wsA = await openClient(url);
    const wsB = await openClient(url);
    const wsC = await openClient(url);
    expect(server.connectionCount).toBe(3);
    wsA.close();
    wsB.close();
    wsC.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(server.connectionCount).toBe(0);
  });

  it('server.stop() closes all connections', async () => {
    const wsA = await openClient(url);
    const wsB = await openClient(url);
    expect(server.connectionCount).toBe(2);

    const closePromiseA = new Promise<void>((res) => wsA.once('close', () => res()));
    const closePromiseB = new Promise<void>((res) => wsB.once('close', () => res()));

    await server.stop();
    await Promise.all([closePromiseA, closePromiseB]);
    expect(server.connectionCount).toBe(0);
  });

  it('error message содержит локализованный text', async () => {
    const ws = await openClient(url);
    // Сначала join с locale=ru
    ws.send(JSON.stringify({
      type: 'join_room',
      roomCode: 'x',
      nickname: 'n',
      locale: 'ru',
    }));
    await nextMessage(ws); // ack room_joined

    // Теперь deploy → должен прийти MATCH_NOT_ACTIVE на русском
    ws.send(JSON.stringify({ type: 'deploy', x: 0, y: 0, tick: 0 }));
    const err = await nextMessage(ws);
    expect(err.type).toBe('error');
    expect((err as any).code).toBe('MATCH_NOT_ACTIVE');
    expect((err as any).locale).toBe('ru');
    expect((err as any).message).toContain('Матч'); // russian text
    ws.close();
  });
});
