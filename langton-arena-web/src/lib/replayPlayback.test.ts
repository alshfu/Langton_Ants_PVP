// src/lib/replayPlayback.test.ts
//
// Тесты на логику playback — pre-indexing inputs по тикам и
// конструкция replay объекта.

import { describe, it, expect } from 'vitest';
import type { DeployAction, Replay } from '@core/contract/replay';

/**
 * Pre-index inputs by tick для O(1) lookup в onTick.
 * Та же логика что в SandboxScreen.startReplayPlayback.
 */
function indexInputsByTick(timeline: DeployAction[]): Map<number, DeployAction[]> {
  const byTick = new Map<number, DeployAction[]>();
  for (const action of timeline) {
    const arr = byTick.get(action.tick);
    if (arr) arr.push(action);
    else byTick.set(action.tick, [action]);
  }
  return byTick;
}

describe('replay playback indexing', () => {
  it('пустой timeline → пустой Map', () => {
    const idx = indexInputsByTick([]);
    expect(idx.size).toBe(0);
  });

  it('single input → один tick в Map', () => {
    const idx = indexInputsByTick([
      { tick: 100, playerIdx: 0, x: 5, y: 5 },
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get(100)).toHaveLength(1);
    expect(idx.get(99)).toBeUndefined();
  });

  it('несколько inputs на один tick → группируются', () => {
    const idx = indexInputsByTick([
      { tick: 50, playerIdx: 0, x: 1, y: 1 },
      { tick: 50, playerIdx: 1, x: 2, y: 2 },
      { tick: 50, playerIdx: 0, x: 3, y: 3 },
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get(50)).toHaveLength(3);
  });

  it('inputs на разные tick'+'s → раздельно', () => {
    const idx = indexInputsByTick([
      { tick: 10, playerIdx: 0, x: 1, y: 1 },
      { tick: 20, playerIdx: 0, x: 2, y: 2 },
      { tick: 30, playerIdx: 0, x: 3, y: 3 },
      { tick: 30, playerIdx: 1, x: 4, y: 4 },
    ]);
    expect(idx.size).toBe(3);
    expect(idx.get(10)).toHaveLength(1);
    expect(idx.get(20)).toHaveLength(1);
    expect(idx.get(30)).toHaveLength(2);
  });

  it('порядок inputs в одном tick сохраняется (FIFO)', () => {
    const idx = indexInputsByTick([
      { tick: 100, playerIdx: 0, x: 10, y: 10 },
      { tick: 100, playerIdx: 1, x: 20, y: 20 },
      { tick: 100, playerIdx: 2, x: 30, y: 30 },
    ]);
    const at100 = idx.get(100)!;
    expect(at100[0]!.playerIdx).toBe(0);
    expect(at100[1]!.playerIdx).toBe(1);
    expect(at100[2]!.playerIdx).toBe(2);
  });

  it('lookup несуществующего тика → undefined (быстрая проверка)', () => {
    const idx = indexInputsByTick([
      { tick: 100, playerIdx: 0, x: 5, y: 5 },
    ]);
    // В onTick проверяем idx.get(sim.tick) — для 99% тиков это undefined,
    // что и должно быть быстрым no-op
    for (let t = 0; t < 200; t++) {
      if (t === 100) continue;
      expect(idx.get(t)).toBeUndefined();
    }
  });

  it('финальная длина — все inputs представлены', () => {
    const inputs: DeployAction[] = [];
    for (let i = 0; i < 50; i++) {
      inputs.push({ tick: i * 10, playerIdx: i % 3, x: i, y: i });
    }
    const idx = indexInputsByTick(inputs);
    let total = 0;
    for (const arr of idx.values()) total += arr.length;
    expect(total).toBe(50);
  });
});

describe('Replay object structure validation', () => {
  function makeMinimalReplay(timeline: DeployAction[]): Replay {
    return {
      version: 1,
      metadata: {
        id: 'test', name: 'Test', createdAt: Date.now(),
        durationTicks: 100, deployCount: timeline.length,
      },
      config: {} as any,
      deployTimeline: timeline,
    };
  }

  it('replay с timeline доступен полностью', () => {
    const timeline: DeployAction[] = [
      { tick: 10, playerIdx: 0, x: 5, y: 5 },
      { tick: 50, playerIdx: 0, x: 10, y: 10 },
    ];
    const replay = makeMinimalReplay(timeline);
    expect(replay.deployTimeline).toHaveLength(2);
    expect(replay.deployTimeline[0]).toEqual({ tick: 10, playerIdx: 0, x: 5, y: 5 });
  });

  it('deployCount metadata совпадает с timeline.length', () => {
    const replay = makeMinimalReplay([
      { tick: 1, playerIdx: 0, x: 0, y: 0 },
      { tick: 2, playerIdx: 0, x: 1, y: 1 },
      { tick: 3, playerIdx: 0, x: 2, y: 2 },
    ]);
    expect(replay.metadata.deployCount).toBe(replay.deployTimeline.length);
  });
});
