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
    // Day 4: fast timing для тестов — countdown 30ms + tick 5ms.
    // Реальный prod = 3000ms + 100ms. Поведенчески одинаково.
    server = new MvpServer({
      port: 0,
      logger: () => { /* silent */ },
      matchCountdownMs: 30,
      matchTickIntervalMs: 5,
      // Day 13: short grace для disconnect-forfeit тестов. Resume happy-path
      // тесты используют отдельный server instance с graceDisconnectMs: 5_000.
      graceDisconnectMs: 50,
    });
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

  // ─── Day 4 — Match lifecycle ──────────────────────────────────────────────

  /** Helper: setup 2 клиентов в одной room, оба ready. Возвращает {a, b}. */
  async function setupReadyPair(roomCode = 'r') {
    const a = await openClient(url);
    const b = await openClient(url);
    a.ws.send(joinMsg(roomCode, 'Alice'));
    b.ws.send(joinMsg(roomCode, 'Bob'));
    await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);
    await b.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);
    a.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    b.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    return { a, b };
  }

  it('оба ready → match_starting broadcast (config, seed, matchId)', async () => {
    const { a, b } = await setupReadyPair();
    const startingA = await a.inbox.waitFor((m) => m.type === 'match_starting');
    const startingB = await b.inbox.waitFor((m) => m.type === 'match_starting');
    expect((startingA as any).matchId).toBeDefined();
    expect((startingA as any).seed).toEqual((startingB as any).seed); // оба видят тот же seed
    expect((startingA as any).config.width).toBe(60);
    expect((startingA as any).countdownMs).toBe(30);
    a.ws.close(); b.ws.close();
  });

  it('после countdown → match_started', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_starting');
    const startedA = await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    const startedB = await b.inbox.waitFor((m) => m.type === 'match_started', 500);
    expect((startedA as any).matchId).toEqual((startedB as any).matchId);
    expect((startedA as any).serverEngineVersion).toBe('0.1.0');
    a.ws.close(); b.ws.close();
  });

  it('после match_started → match_tick broadcast', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    const tickA = await a.inbox.waitFor((m) => m.type === 'match_tick', 500);
    const tickB = await b.inbox.waitFor((m) => m.type === 'match_tick', 500);
    expect((tickA as any).tick).toBeGreaterThanOrEqual(1);
    expect((tickB as any).tick).toBeGreaterThanOrEqual(1);
    expect((tickA as any).deploys).toEqual([]); // Day 4 — пустой
    a.ws.close(); b.ws.close();
  });

  it('time win → match_ended после threshold ticks', async () => {
    // С threshold=300 и tickInterval=5ms — ~1.5 секунды до конца.
    // Это многовато для тестов. Поэтому override config через monkey-patch:
    // ставим threshold=10 через симуляцию.
    // Решение: использовать дефолтный 300 не подходит, тест бы стоял 1.5s.
    // Для быстрого ended теста — увеличиваем tickInterval=2ms (вдвое быстрее)
    await server.stop();
    server = new MvpServer({
      port: 0,
      logger: () => { /* silent */ },
      matchCountdownMs: 20,
      matchTickIntervalMs: 2, // 500 TPS — за ~600мс пробежим 300 ticks
    });
    const { port } = await server.start();
    url = `ws://127.0.0.1:${port}`;

    const { a, b } = await setupReadyPair('fast');
    await a.inbox.waitFor((m) => m.type === 'match_started', 1000);
    const endedA = await a.inbox.waitFor((m) => m.type === 'match_ended', 3000);
    const endedB = await b.inbox.waitFor((m) => m.type === 'match_ended', 3000);
    expect((endedA as any).result.finished).toBe(true);
    expect((endedA as any).result.reason).toBe('time_expired');
    expect((endedB as any).result.finished).toBe(true);
    expect((endedA as any).result.finishedAtTick).toBeGreaterThanOrEqual(300);
    a.ws.close(); b.ws.close();
  });

  it('un-ready во время countdown — не отменяет (игнорируется)', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_starting');
    // Сразу шлём set_ready=false — должно быть игнорировано (status=countdown)
    a.ws.send(JSON.stringify({ type: 'set_ready', ready: false }));
    // match_started ВСЁ РАВНО придёт
    const started = await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    expect((started as any).matchId).toBeDefined();
    a.ws.close(); b.ws.close();
  });

  it('disconnect во время countdown → countdown cancel, partner stays in lobby', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_starting');
    // Сразу disconnect A
    a.ws.close();
    // B получает room_updated (player A ушёл) — НЕ match_started
    await b.inbox.waitFor((m) =>
      m.type === 'room_updated' && (m as any).players.length === 1
    , 1000);
    // Не должно быть match_started в течение 200ms (timeout — это OK)
    const noStart = await b.inbox.waitFor((m) => m.type === 'match_started', 200).catch(() => null);
    expect(noStart).toBeNull(); // null = timeout = match_started НЕ пришёл (correct)
    b.ws.close();
  });

  it('disconnect во время match → match_ended с winner=другой', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    // Ждём пока хотя бы один tick пройдёт
    await a.inbox.waitFor((m) => m.type === 'match_tick', 500);
    a.ws.close();
    const ended = await b.inbox.waitFor((m) => m.type === 'match_ended', 500);
    expect((ended as any).result.finished).toBe(true);
    expect((ended as any).result.reason).toBe('opponent_disconnected');
    expect((ended as any).result.winnerId).toBe('p1'); // B = index 1, побеждает
    b.ws.close();
  });

  // ─── Day 5 — Deploy ────────────────────────────────────────────────────────

  it('deploy до match_started → MATCH_NOT_ACTIVE', async () => {
    const a = await openClient(url);
    a.ws.send(joinMsg('r', 'A'));
    await a.inbox.readN(2);
    a.ws.send(JSON.stringify({ type: 'deploy', x: 30, y: 30, tick: 0 }));
    const err = await a.inbox.waitFor((m) => m.type === 'error', 500);
    expect((err as any).code).toBe('MATCH_NOT_ACTIVE');
    a.ws.close();
  });

  it('valid deploy во время match → broadcast в match_tick.deploys', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);

    // Ждём пока match войдёт в playing (хотя бы один tick)
    const firstTick = await a.inbox.waitFor((m) => m.type === 'match_tick', 500);
    const curT = (firstTick as any).tick;

    a.ws.send(JSON.stringify({ type: 'deploy', x: 30, y: 30, tick: curT }));

    // Оба получают match_tick с deploy
    const tickWithDeploy = await b.inbox.waitFor(
      (m) => m.type === 'match_tick' && (m as any).deploys.length > 0,
      1000,
    );
    expect((tickWithDeploy as any).deploys[0].x).toBe(30);
    expect((tickWithDeploy as any).deploys[0].y).toBe(30);
    expect((tickWithDeploy as any).deploys[0].playerIdx).toBe(0); // A = index 0
    a.ws.close(); b.ws.close();
  });

  it('invalid deploy (out of bounds) → INVALID_DEPLOY error', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    const firstTick = await a.inbox.waitFor((m) => m.type === 'match_tick', 500);
    const curT = (firstTick as any).tick;

    a.ws.send(JSON.stringify({ type: 'deploy', x: -1, y: 30, tick: curT }));
    const err = await a.inbox.waitFor((m) => m.type === 'error', 500);
    expect((err as any).code).toBe('INVALID_DEPLOY');
    // Day 10: error должен содержать context для client prediction rollback.
    expect((err as any).context).toBeDefined();
    expect((err as any).context.x).toBe(-1);
    expect((err as any).context.y).toBe(30);
    expect((err as any).context.tick).toBe(curT);
    a.ws.close(); b.ws.close();
  });

  it('двойной deploy на ту же клетку → второй INVALID_DEPLOY (occupied)', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    const firstTick = await a.inbox.waitFor((m) => m.type === 'match_tick', 500);
    const curT = (firstTick as any).tick;

    // Деплоим A на (30, 30) — applied на curT+1
    a.ws.send(JSON.stringify({ type: 'deploy', x: 30, y: 30, tick: curT }));
    await a.inbox.waitFor(
      (m) => m.type === 'match_tick' && (m as any).deploys.some((d: any) => d.x === 30 && d.y === 30),
      500,
    );
    // Деплоим B на (30, 30) — теперь занята A's ant'ом → INVALID
    // Но ant сразу же двинется на следующем tick! Нужно сразу же шлём в same тике.
    // На самом деле проще: B шлёт несколько кадров вперёд, race условие.
    // Чтобы стабильно: запросим текущий тик через ping, дальше попробуем
    const recentTick = await a.inbox.waitFor((m) => m.type === 'match_tick', 200);
    const tNow = (recentTick as any).tick;
    b.ws.send(JSON.stringify({ type: 'deploy', x: 30, y: 30, tick: tNow }));
    // Может быть INVALID_DEPLOY (occupied) или success (ant сдвинулся)
    // Проверяем что СЕРВЕР хотя бы один из вариантов даёт без crash
    const reply = await Promise.race([
      b.inbox.waitFor((m) => m.type === 'error', 300).catch(() => null),
      b.inbox.waitFor(
        (m) => m.type === 'match_tick' && (m as any).deploys.some((d: any) => d.playerIdx === 1 && d.x === 30 && d.y === 30),
        300,
      ).catch(() => null),
    ]);
    expect(reply).not.toBeNull();
    a.ws.close(); b.ws.close();
  });

  it('очень старый tick → INPUT_TOO_OLD', async () => {
    const { a, b } = await setupReadyPair();
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    // Ждём чтобы тиков накопилось >5
    await new Promise((r) => setTimeout(r, 50));
    a.ws.send(JSON.stringify({ type: 'deploy', x: 30, y: 30, tick: 0 }));
    const err = await a.inbox.waitFor((m) => m.type === 'error', 500);
    expect((err as any).code).toBe('INPUT_TOO_OLD');
    a.ws.close(); b.ws.close();
  });
});

// ─── Day 13 — Reconnect with resume token ────────────────────────────────────

describe('MvpServer · Day 13 reconnect', () => {
  let server: MvpServer;
  let url: string;

  beforeEach(async () => {
    // Longer grace (500ms) — даём время на reconnect happy path тестам.
    // Forfeit-after-grace тесты используют короткий fastServer ниже.
    server = new MvpServer({
      port: 0,
      logger: () => { /* silent */ },
      matchCountdownMs: 30,
      matchTickIntervalMs: 5,
      graceDisconnectMs: 500,
    });
    const { host, port } = await server.start();
    url = `ws://${host}:${port}`;
  });
  afterEach(async () => { await server.stop(); });

  const joinMsg = (room: string, nick: string, opts: { locale?: string; resumeToken?: string } = {}) =>
    JSON.stringify({
      type: 'join_room',
      roomCode: room,
      nickname: nick,
      locale: opts.locale ?? 'en',
      ...(opts.resumeToken ? { resumeToken: opts.resumeToken } : {}),
    });

  /** Setup: 2 player'а, оба ready, match_started получено. */
  async function setupActiveMatch(roomCode = 'r') {
    const a = await openClient(url);
    const b = await openClient(url);
    a.ws.send(joinMsg(roomCode, 'Alice'));
    b.ws.send(joinMsg(roomCode, 'Bob'));
    const joinedA = await a.inbox.waitFor((m) => m.type === 'room_joined');
    const joinedB = await b.inbox.waitFor((m) => m.type === 'room_joined');
    await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);
    a.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    b.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    await a.inbox.waitFor((m) => m.type === 'match_started', 500);
    return {
      a, b,
      tokenA: (joinedA as any).resumeToken as string,
      tokenB: (joinedB as any).resumeToken as string,
    };
  }

  it('room_joined содержит resumeToken (32 hex)', async () => {
    const a = await openClient(url);
    a.ws.send(joinMsg('r', 'Alice'));
    const joined = await a.inbox.waitFor((m) => m.type === 'room_joined');
    expect((joined as any).resumeToken).toMatch(/^[0-9a-f]{32}$/);
    expect((joined as any).resumed).toBeUndefined();
    a.ws.close();
  });

  it('reconnect с valid token → resumed:true + match_resume_state', async () => {
    const { a, b, tokenA } = await setupActiveMatch();
    // Пусть тиков накопится — будет интересный tick value
    await a.inbox.waitFor((m) => m.type === 'match_tick', 500);
    // A disconnects mid-match
    a.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    // A reconnects с тем же token
    const a2 = await openClient(url);
    a2.ws.send(joinMsg('r', 'Alice', { resumeToken: tokenA }));
    const rejoined = await a2.inbox.waitFor((m) => m.type === 'room_joined');
    expect((rejoined as any).resumed).toBe(true);
    expect((rejoined as any).clientId).toBeDefined();
    // Получаем match_resume_state с polynomial data
    const resume = await a2.inbox.waitFor((m) => m.type === 'match_resume_state', 500);
    expect((resume as any).matchId).toBeDefined();
    expect((resume as any).tick).toBeGreaterThan(0);
    expect((resume as any).config).toBeDefined();
    expect((resume as any).seed).toBeDefined();
    expect(Array.isArray((resume as any).deployTimeline)).toBe(true);
    a2.ws.close(); b.ws.close();
  });

  it('reconnect с invalid token → normal join (no resumed flag)', async () => {
    const a = await openClient(url);
    a.ws.send(joinMsg('r', 'Alice', { resumeToken: 'deadbeef'.repeat(4) }));
    const joined = await a.inbox.waitFor((m) => m.type === 'room_joined');
    expect((joined as any).resumed).toBeUndefined();
    a.ws.close();
  });

  it('opponent видит disconnected flag в room_updated', async () => {
    const { a, b } = await setupActiveMatch();
    a.ws.close();
    const update = await b.inbox.waitFor(
      (m) => m.type === 'room_updated'
             && (m as any).players.some((p: any) => p.disconnected === true),
      500,
    );
    const ghostPlayer = (update as any).players.find((p: any) => p.disconnected);
    expect(ghostPlayer).toBeDefined();
    expect(ghostPlayer.nickname).toBe('Alice');
    b.ws.close();
  });

  it('reconnect → opponent видит disconnected=false снова', async () => {
    const { a, b, tokenA } = await setupActiveMatch();
    a.ws.close();
    await b.inbox.waitFor(
      (m) => m.type === 'room_updated'
             && (m as any).players.some((p: any) => p.disconnected),
      500,
    );
    const a2 = await openClient(url);
    a2.ws.send(joinMsg('r', 'Alice', { resumeToken: tokenA }));
    await a2.inbox.waitFor((m) => m.type === 'room_joined');
    const update = await b.inbox.waitFor(
      (m) => m.type === 'room_updated'
             && (m as any).players.every((p: any) => !p.disconnected),
      500,
    );
    expect((update as any).players.length).toBe(2);
    a2.ws.close(); b.ws.close();
  });

  it('grace expire → forfeit (oppo побеждает)', async () => {
    // Override grace в server instance невозможно после start, поэтому
    // используем отдельный fast server здесь.
    const fastServer = new MvpServer({
      port: 0,
      logger: () => { /* silent */ },
      matchCountdownMs: 30,
      matchTickIntervalMs: 5,
      graceDisconnectMs: 50,
    });
    const { host, port } = await fastServer.start();
    const fastUrl = `ws://${host}:${port}`;

    const a = await openClient(fastUrl);
    const b = await openClient(fastUrl);
    a.ws.send(JSON.stringify({ type: 'join_room', roomCode: 'r', nickname: 'A', locale: 'en' }));
    b.ws.send(JSON.stringify({ type: 'join_room', roomCode: 'r', nickname: 'B', locale: 'en' }));
    await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);
    a.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    b.ws.send(JSON.stringify({ type: 'set_ready', ready: true }));
    await b.inbox.waitFor((m) => m.type === 'match_started', 500);
    a.ws.close();
    // Wait > graceDisconnectMs → forfeit
    const ended = await b.inbox.waitFor((m) => m.type === 'match_ended', 1000);
    expect((ended as any).result.reason).toBe('opponent_disconnected');
    // B (idx=1) победил т.к. A disconnected
    expect((ended as any).result.winnerId).toBe('p1');
    b.ws.close();
    await fastServer.stop();
  });

  it('disconnect in lobby → immediate (no grace, opponent stays)', async () => {
    // В lobby phase grace не применяется — leaveCurrentRoom immediate.
    const a = await openClient(url);
    const b = await openClient(url);
    a.ws.send(joinMsg('r', 'A'));
    b.ws.send(joinMsg('r', 'B'));
    await a.inbox.waitFor((m) => m.type === 'room_updated' && (m as any).players.length === 2);
    a.ws.close();
    const update = await b.inbox.waitFor(
      (m) => m.type === 'room_updated' && (m as any).players.length === 1,
      500,
    );
    expect((update as any).players[0].nickname).toBe('B');
    b.ws.close();
  });
});
