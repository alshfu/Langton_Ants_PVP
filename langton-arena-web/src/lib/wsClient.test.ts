// src/lib/wsClient.test.ts
//
// Stage 8 Day 6 — WSClient unit tests с mock WebSocket constructor.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WSClient, type WSClientState } from './wsClient';
import type { ServerMessage } from '@langton/core';

// ─── Mock WebSocket ─────────────────────────────────────────────────────────

/** Minimal MockWebSocket — mirror native API enough для WSClient. */
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = 0; // CONNECTING
  url: string;
  sentMessages: string[] = [];
  private listeners: Record<string, Array<(ev: any) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(event: string, cb: (ev: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(cb);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('not open');
    }
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch('close', { code, reason });
  }

  // ─── Test helpers ─────────────────────────────────────────────────────────

  fireOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.dispatch('open', {});
  }

  fireMessage(data: string | object): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.dispatch('message', { data: payload });
  }

  fireClose(code = 1006, reason = 'abnormal'): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch('close', { code, reason });
  }

  fireError(): void {
    this.dispatch('error', new Event('error'));
  }

  private dispatch(event: string, payload: any): void {
    (this.listeners[event] ?? []).forEach((cb) => cb(payload));
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
});

describe('WSClient — basic', () => {
  it('initial state = idle', () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    expect(client.state).toBe('idle');
    expect(client.isOpen).toBe(false);
    expect(client.url).toBe('ws://test');
  });

  it('connect() → state=connecting, после open → resolved + state=open', async () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    const promise = client.connect();
    expect(client.state).toBe('connecting');
    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).toBe('ws://test');
    ws.fireOpen();
    await promise;
    expect(client.state).toBe('open');
    expect(client.isOpen).toBe(true);
  });

  it('connect() idempotent — повторный вызов после open → resolved сразу', async () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    const p1 = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p1;
    // Второй connect не создаёт новый WS
    const lenBefore = MockWebSocket.instances.length;
    await client.connect();
    expect(MockWebSocket.instances.length).toBe(lenBefore);
  });

  it('send() сериализует в JSON и отправляет', async () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    const promise = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await promise;
    const ok = client.send({ type: 'ping', t: 42 });
    expect(ok).toBe(true);
    const ws = MockWebSocket.instances[0]!;
    expect(ws.sentMessages).toHaveLength(1);
    expect(JSON.parse(ws.sentMessages[0]!)).toEqual({ type: 'ping', t: 42 });
  });

  it('send() до open → return false, no exception', () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    expect(client.send({ type: 'ping', t: 1 })).toBe(false);
  });
});

describe('WSClient — message handling', () => {
  it('onMessage callback вызывается с parsed JSON', async () => {
    const received: ServerMessage[] = [];
    const client = new WSClient({
      url: 'ws://test',
      onMessage: (m) => received.push(m),
      websocketCtor: MockWebSocket as any,
    });
    const promise = client.connect();
    const ws = MockWebSocket.instances[0]!;
    ws.fireOpen();
    await promise;

    ws.fireMessage({ type: 'pong', t: 1, serverT: 999 });
    ws.fireMessage({ type: 'room_joined', roomCode: 'r', clientId: 'c', players: [] });

    expect(received).toHaveLength(2);
    expect(received[0]!.type).toBe('pong');
    expect((received[1] as any).roomCode).toBe('r');
  });

  it('malformed JSON → warning в console, не вызывает onMessage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const received: ServerMessage[] = [];
    const client = new WSClient({
      url: 'ws://test',
      onMessage: (m) => received.push(m),
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    const ws = MockWebSocket.instances[0]!;
    ws.fireOpen();
    await p;
    ws.fireMessage('not-json{{');
    expect(received).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('message без type field — игнорируется', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const received: ServerMessage[] = [];
    const client = new WSClient({
      url: 'ws://test',
      onMessage: (m) => received.push(m),
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p;
    MockWebSocket.instances[0]!.fireMessage({ foo: 'bar' });
    expect(received).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('WSClient — lifecycle callbacks', () => {
  it('onStateChange вызывается при transitions', async () => {
    const states: WSClientState[] = [];
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      onStateChange: (s) => states.push(s),
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p;
    expect(states).toEqual(['connecting', 'open']);
    client.disconnect();
    expect(states).toContain('closed');
  });

  it('onClose вызывается с code+reason', async () => {
    const closeArgs: Array<{ code: number; reason: string }> = [];
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      onClose: (c, r) => closeArgs.push({ code: c, reason: r }),
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p;
    MockWebSocket.instances[0]!.fireClose(1006, 'abnormal');
    expect(closeArgs).toHaveLength(1);
    expect(closeArgs[0]).toEqual({ code: 1006, reason: 'abnormal' });
    expect(client.state).toBe('closed');
  });

  it('disconnect() закрывает соединение', async () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p;
    expect(client.state).toBe('open');
    client.disconnect();
    expect(client.state).toBe('closed');
    expect(MockWebSocket.instances[0]!.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('connect failed (close до open) → reject', async () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireClose(1006, 'refused');
    await expect(p).rejects.toThrow(/connect failed/);
    expect(client.state).toBe('closed');
  });
});

describe('WSClient — auto-reconnect skeleton', () => {
  it('autoReconnect=false (default) — после close не реконнектит', async () => {
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p;
    expect(MockWebSocket.instances.length).toBe(1);
    MockWebSocket.instances[0]!.fireClose(1006);
    await new Promise((r) => setTimeout(r, 50));
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it('autoReconnect=true — после close планирует reconnect', async () => {
    vi.useFakeTimers();
    const client = new WSClient({
      url: 'ws://test',
      onMessage: () => {},
      autoReconnect: true,
      reconnectDelayMs: 100,
      websocketCtor: MockWebSocket as any,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.fireOpen();
    await p;
    MockWebSocket.instances[0]!.fireClose(1006, 'network');
    expect(MockWebSocket.instances.length).toBe(1);
    // Через 100ms должен создать второй WS
    await vi.advanceTimersByTimeAsync(150);
    expect(MockWebSocket.instances.length).toBe(2);
    client.disconnect();
    vi.useRealTimers();
  });
});
