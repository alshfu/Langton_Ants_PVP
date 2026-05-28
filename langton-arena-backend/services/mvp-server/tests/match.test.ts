// tests/match.test.ts
//
// Stage 8 Day 4 — Match class unit tests (без real WebSocket).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Match, buildAntsFromConfig, buildBirthConfig } from '../src/match';
import { defaultMatchConfig } from '../src/matchConfig';
import { Room } from '../src/room';
import type { ServerMessage } from '../src/messages';

class MockConn {
  clientId: string;
  nickname: string;
  locale = 'en';
  ready = false;
  roomCode: string | null = null;
  closed = false;
  sent: ServerMessage[] = [];

  constructor(id: string, nickname: string) {
    this.clientId = id;
    this.nickname = nickname;
  }
  send(m: ServerMessage) { this.sent.push(m); }
  sendError() { /* noop */ }
  setLocale(l: string) { this.locale = l; }
  close() { this.closed = true; }
}

function makeRoomWith2Players(): Room {
  const room = new Room('test');
  const a = new MockConn('a', 'Alice');
  const b = new MockConn('b', 'Bob');
  room.addPlayer(a as any);
  room.addPlayer(b as any);
  return room;
}

describe('Match — helpers', () => {
  it('buildAntsFromConfig из defaultMatchConfig → 6 ants (2p × 3)', () => {
    const cfg = defaultMatchConfig(42);
    const ants = buildAntsFromConfig(cfg);
    expect(ants).toHaveLength(6);
    expect(ants.filter((a) => a.owner === 0)).toHaveLength(3);
    expect(ants.filter((a) => a.owner === 1)).toHaveLength(3);
    // P0 ants начинаются в углу 5,5 / 6,6 / 7,7
    expect(ants[0]!.x).toBe(5);
    expect(ants[0]!.y).toBe(5);
  });

  it('buildBirthConfig — birth disabled → null', () => {
    const cfg = defaultMatchConfig(42);
    expect(buildBirthConfig(cfg)).not.toBeNull();
    const off = { ...cfg, birthEnabled: false };
    expect(buildBirthConfig(off)).toBeNull();
  });

  it('buildBirthConfig — mutation enabled → mutation object присутствует', () => {
    const cfg = defaultMatchConfig(42);
    const bc = buildBirthConfig(cfg)!;
    expect(bc.mutation).toBeDefined();
    expect(bc.mutation!.haloEnabled).toBe(true);
  });
});

describe('Match — lifecycle', () => {
  let room: Room;
  let cfg: ReturnType<typeof defaultMatchConfig>;

  beforeEach(() => {
    room = makeRoomWith2Players();
    cfg = defaultMatchConfig(42);
  });

  afterEach(() => {
    if (room.activeMatch) room.activeMatch.stop();
  });

  it('конструктор инициализирует sim, tick=0, not finished', () => {
    const m = new Match(room, cfg, 'match-1');
    expect(m.currentTick).toBe(0);
    expect(m.isFinished).toBe(false);
    expect(m.matchId).toBe('match-1');
    expect(m.seed).toBe(42);
  });

  it('start() запускает tick loop, currentTick инкрементируется', async () => {
    const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
    m.start();
    await new Promise((r) => setTimeout(r, 60));
    m.stop();
    expect(m.currentTick).toBeGreaterThan(5);
  });

  it('broadcast match_tick на каждом тике', async () => {
    const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
    m.start();
    await new Promise((r) => setTimeout(r, 40));
    m.stop();
    const [a, b] = room.players;
    const tickMsgsA = (a as any as MockConn).sent.filter((s) => s.type === 'match_tick');
    const tickMsgsB = (b as any as MockConn).sent.filter((s) => s.type === 'match_tick');
    expect(tickMsgsA.length).toBeGreaterThan(0);
    expect(tickMsgsB.length).toBe(tickMsgsA.length); // оба получают
    // deploys array пуст в Day 4
    expect((tickMsgsA[0] as any).deploys).toEqual([]);
  });

  it('time win condition: tick >= threshold → match_ended', async () => {
    // Маленький threshold чтобы тест бежал быстро
    const fast = { ...cfg, winCondition: { kind: 'time' as const, threshold: 5 } };
    const m = new Match(room, fast, 'm', { tickIntervalMs: 5 });
    m.start();
    // Ждём пока match_ended придёт
    await new Promise((r) => setTimeout(r, 100));
    expect(m.isFinished).toBe(true);
    expect(room.status).toBe('finished');
    const a = room.players[0] as any as MockConn;
    const ended = a.sent.find((s) => s.type === 'match_ended') as any;
    expect(ended).toBeDefined();
    expect(ended.result.finished).toBe(true);
    // Day 11: time_expired_tie если 0 territory captures, time_expired иначе.
    expect(ended.result.reason).toMatch(/^time_expired/);
    expect(ended.result.finishedAtTick).toBeGreaterThanOrEqual(5);
    // Territory breakdown должен быть включён
    expect(Array.isArray(ended.result.territory)).toBe(true);
    expect(ended.result.territory.length).toBe(2);
    // Day 12: inline replay payload должен быть включён
    expect(ended.replay).toBeDefined();
    expect(ended.replay.version).toBe(1);
    expect(ended.replay.metadata.id).toContain('pvp-');
    expect(ended.replay.metadata.durationTicks).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(ended.replay.deployTimeline)).toBe(true);
    expect(ended.replay.config).toBeDefined();
    expect(ended.replay.config.seed).toBe(fast.seed);
  });

  it('stop() prevents дальнейшие ticks', async () => {
    const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
    m.start();
    await new Promise((r) => setTimeout(r, 20));
    const tickBefore = m.currentTick;
    m.stop();
    await new Promise((r) => setTimeout(r, 30));
    expect(m.currentTick).toBe(tickBefore);
  });

  it('endWith — принудительное завершение с winner', () => {
    const m = new Match(room, cfg, 'm');
    m.endWith(1, 'opponent_disconnected');
    expect(m.isFinished).toBe(true);
    const a = room.players[0] as any as MockConn;
    const ended = a.sent.find((s) => s.type === 'match_ended') as any;
    expect(ended).toBeDefined();
    expect(ended.result.winnerId).toBe('p1');
    expect(ended.result.reason).toBe('opponent_disconnected');
  });

  it('endWith идемпотентен (повторный вызов — no-op)', () => {
    const m = new Match(room, cfg, 'm');
    m.endWith(0, 'first');
    const a = room.players[0] as any as MockConn;
    const before = a.sent.length;
    m.endWith(1, 'second');
    expect(a.sent.length).toBe(before);
  });

  it('детерминизм: same seed + same config → same sim state через N ticks', async () => {
    const m1 = new Match(room, cfg, 'a', { tickIntervalMs: 5 });
    m1.start();
    await new Promise((r) => setTimeout(r, 50));
    m1.stop();
    const tick1 = m1.currentTick;
    const state1 = Array.from(m1.simState.owner);

    // Reset room для второго матча
    const room2 = makeRoomWith2Players();
    const m2 = new Match(room2, cfg, 'b', { tickIntervalMs: 5 });
    m2.start();
    // Бежим столько же ticks
    await new Promise((r) => {
      const check = () => {
        if (m2.currentTick >= tick1) {
          m2.stop();
          r(null);
        } else {
          setTimeout(check, 5);
        }
      };
      check();
    });
    expect(Array.from(m2.simState.owner)).toEqual(state1);
  });
});

describe('Match — error paths', () => {
  let cfg: ReturnType<typeof defaultMatchConfig>;
  beforeEach(() => { cfg = defaultMatchConfig(42); });

  it('start() после finish — no-op', () => {
    const room = makeRoomWith2Players();
    const m = new Match(room, cfg, 'm');
    m.endWith(0, 'forced');
    m.start(); // не должен ничего ломать
    expect(m.isFinished).toBe(true);
  });

  it('start() двойной — second start игнорируется', async () => {
    const room = makeRoomWith2Players();
    const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
    m.start();
    m.start(); // double — должен быть no-op
    await new Promise((r) => setTimeout(r, 30));
    m.stop();
    // если был double interval — sent.length был бы 2x. Проверим что один inteval.
    const a = room.players[0] as any as MockConn;
    const ticks = a.sent.filter((s) => s.type === 'match_tick');
    // ~30ms / 5ms = ~6 ticks. Не 12.
    expect(ticks.length).toBeLessThan(10);
  });
});

// Vi is imported but not strictly needed — placeholder для будущих spy/mocks.
void vi;
