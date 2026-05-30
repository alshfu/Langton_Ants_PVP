// tests/spectator.test.ts
//
// Stage 9.4: spectator mode — 3rd+ connection joins room, gets all
// broadcasts but cannot deploy/set_ready/request_rematch.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { MvpServer } from '../src/server.js';
import type { ServerMessage } from '../src/messages.js';

class Inbox {
  msgs: ServerMessage[] = [];
  private resolvers: Array<{ resolve: (m: ServerMessage) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];
  push(m: ServerMessage): void {
    const pending = this.resolvers.shift();
    if (pending) { clearTimeout(pending.timer); pending.resolve(m); }
    else { this.msgs.push(m); }
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
    try { inbox.push(JSON.parse(data.toString('utf8'))); } catch { /* */ }
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  return { ws, inbox };
}

function joinAsPlayer(room: string, nick: string, locale = 'en'): string {
  return JSON.stringify({ type: 'join_room', roomCode: room, nickname: nick, locale });
}

function joinAsSpectator(room: string, nick: string, locale = 'en'): string {
  return JSON.stringify({ type: 'join_room', roomCode: room, nickname: nick, locale, spectator: true });
}

describe('MvpServer · Stage 9.4 spectator', () => {
  let server: MvpServer;
  let url: string;

  beforeEach(async () => {
    server = new MvpServer({
      port: 0,
      logger: () => { /* silent */ },
      matchCountdownMs: 30,
      matchTickIntervalMs: 5,
      graceDisconnectMs: 50,
    });
    const { host, port } = await server.start();
    url = `ws://${host}:${port}`;
  });

  afterEach(async () => { await server.stop(); });

  it('spectator joins room — gets asSpectator:true в room_joined', async () => {
    const room = 'SPEC1';
    // Player A joins first
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    // Spectator joins
    const { ws: wsS, inbox: ibS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Bob'));
    const joined = await ibS.waitFor((m) => m.type === 'room_joined');
    expect((joined as { asSpectator?: boolean }).asSpectator).toBe(true);
    expect((joined as { players: unknown[] }).players).toHaveLength(1); // only Alice
    wsA.close(); wsS.close();
  });

  it('spectator NOT counted в room.players (room not full)', async () => {
    const room = 'SPEC2';
    // 2 players fill room
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    const { ws: wsB, inbox: ibB } = await openClient(url);
    wsB.send(joinAsPlayer(room, 'Bob'));
    await ibB.waitFor((m) => m.type === 'room_joined');

    // Spectator joins — should succeed despite "room full" for players
    const { ws: wsS, inbox: ibS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Charlie'));
    const joined = await ibS.waitFor((m) => m.type === 'room_joined');
    expect((joined as { asSpectator?: boolean }).asSpectator).toBe(true);

    // 3rd PLAYER (non-spectator) should be rejected with ROOM_FULL
    const { ws: wsD, inbox: ibD } = await openClient(url);
    wsD.send(joinAsPlayer(room, 'Dave'));
    const err = await ibD.waitFor((m) => m.type === 'error');
    expect((err as { code: string }).code).toBe('ROOM_FULL');

    wsA.close(); wsB.close(); wsS.close(); wsD.close();
  });

  it('players get spectator_joined broadcast', async () => {
    const room = 'SPEC3';
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    // Spectator joins — Alice should get spectator_joined broadcast
    const { ws: wsS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Bob'));
    const broadcast = await ibA.waitFor((m) => m.type === 'spectator_joined');
    const specs = (broadcast as { spectators: { nickname: string }[] }).spectators;
    expect(specs).toHaveLength(1);
    expect(specs[0]!.nickname).toBe('Bob');
    wsA.close(); wsS.close();
  });

  it('spectator deploy → SPECTATOR_CANT_PLAY error', async () => {
    const room = 'SPEC4';
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    const { ws: wsS, inbox: ibS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Spec1'));
    await ibS.waitFor((m) => m.type === 'room_joined');

    // Spectator tries deploy — should get SPECTATOR_CANT_PLAY
    wsS.send(JSON.stringify({ type: 'deploy', x: 5, y: 5, tick: 0 }));
    const err = await ibS.waitFor((m) => m.type === 'error');
    expect((err as { code: string }).code).toBe('SPECTATOR_CANT_PLAY');
    wsA.close(); wsS.close();
  });

  it('spectator set_ready → SPECTATOR_CANT_PLAY error', async () => {
    const room = 'SPEC5';
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    const { ws: wsS, inbox: ibS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Spec1'));
    await ibS.waitFor((m) => m.type === 'room_joined');

    wsS.send(JSON.stringify({ type: 'set_ready', ready: true }));
    const err = await ibS.waitFor((m) => m.type === 'error');
    expect((err as { code: string }).code).toBe('SPECTATOR_CANT_PLAY');
    wsA.close(); wsS.close();
  });

  it('multiple spectators OK', async () => {
    const room = 'SPEC6';
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    const sockets: WebSocket[] = [];
    for (let i = 0; i < 3; i++) {
      const { ws, inbox } = await openClient(url);
      ws.send(joinAsSpectator(room, `Spec${i + 1}`));
      const joined = await inbox.waitFor((m) => m.type === 'room_joined');
      expect((joined as { asSpectator?: boolean }).asSpectator).toBe(true);
      sockets.push(ws);
    }

    // Last broadcast Alice receives — spectators should be 3
    const lastSpec = await ibA.waitFor((m) =>
      m.type === 'spectator_joined' &&
      (m as { spectators: unknown[] }).spectators.length === 3);
    expect((lastSpec as { spectators: unknown[] }).spectators).toHaveLength(3);

    wsA.close();
    for (const s of sockets) s.close();
  });

  it('spectator gets match_starting + match_tick broadcasts', async () => {
    const room = 'SPEC7';
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    const { ws: wsB, inbox: ibB } = await openClient(url);
    wsB.send(joinAsPlayer(room, 'Bob'));
    await ibB.waitFor((m) => m.type === 'room_joined');

    const { ws: wsS, inbox: ibS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Charlie'));
    await ibS.waitFor((m) => m.type === 'room_joined');

    // Both players ready → match starts
    wsA.send(JSON.stringify({ type: 'set_ready', ready: true }));
    wsB.send(JSON.stringify({ type: 'set_ready', ready: true }));

    // Spectator should also see match_starting
    const starting = await ibS.waitFor((m) => m.type === 'match_starting', 1500);
    expect(starting.type).toBe('match_starting');

    // And subsequent match_tick'и
    const tick = await ibS.waitFor((m) => m.type === 'match_tick', 1500);
    expect(tick.type).toBe('match_tick');

    wsA.close(); wsB.close(); wsS.close();
  });

  it('spectator leave → spectator_left broadcast', async () => {
    const room = 'SPEC8';
    const { ws: wsA, inbox: ibA } = await openClient(url);
    wsA.send(joinAsPlayer(room, 'Alice'));
    await ibA.waitFor((m) => m.type === 'room_joined');

    const { ws: wsS } = await openClient(url);
    wsS.send(joinAsSpectator(room, 'Bob'));
    await ibA.waitFor((m) => m.type === 'spectator_joined');

    wsS.close();

    const left = await ibA.waitFor((m) => m.type === 'spectator_left');
    expect((left as { spectators: unknown[] }).spectators).toHaveLength(0);

    wsA.close();
  });
});
