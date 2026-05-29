// src/lib/botPlayer.test.ts
//
// Тесты для pure helper functions BotPlayer.
// Class instance не тестируем (нужен real WS) — это integration territory.

import { describe, it, expect } from 'vitest';
import {
  shouldDeploy, pickDeployLocation,
  botDisplayName, isBotNickname,
  shouldDeployJittered, findFrontierCells,
  pickSmartDeployLocation, computeMyTerritoryPercent, isPanicMode,
} from './botPlayer';
import type { SimState, SandboxConfig } from '@langton/core';

/** Helper: build minimal SimState с заданной owner grid. */
function makeSim(width: number, height: number, ownerData: number[]): SimState {
  return {
    tick: 0,
    width,
    height,
    owner: new Uint8Array(ownerData),
    state: new Uint8Array(width * height),
    ants: [],
  } as unknown as SimState;
}

/** Minimal config для smart picker tests. */
function makeConfig(w: number, h: number): SandboxConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { width: w, height: h, players: [{}, {}] } as any;
}

describe('shouldDeploy', () => {
  it('false если ещё не дошли до interval', () => {
    expect(shouldDeploy(10, 5, 'easy')).toBe(false);    // 5 ticks < 50
    expect(shouldDeploy(20, 0, 'normal')).toBe(false);  // 20 < 30
    expect(shouldDeploy(10, 0, 'hard')).toBe(false);    // 10 < 15
  });

  it('true если interval достигнут', () => {
    expect(shouldDeploy(50, 0, 'easy')).toBe(true);     // 50 ≥ 50
    expect(shouldDeploy(30, 0, 'normal')).toBe(true);
    expect(shouldDeploy(15, 0, 'hard')).toBe(true);
  });

  it('false если уже deploy на этом tick (idempotent)', () => {
    expect(shouldDeploy(100, 100, 'easy')).toBe(false);
  });

  it('hard deploys в 3x чаще чем easy', () => {
    // easy 50, hard 15. 4 раз в 100 ticks easy vs 6 раз hard.
    const easyDeploys = countDeploys(100, 'easy');
    const hardDeploys = countDeploys(100, 'hard');
    expect(hardDeploys).toBeGreaterThan(easyDeploys);
  });

  function countDeploys(totalTicks: number, diff: 'easy' | 'normal' | 'hard'): number {
    let last = -1; let n = 0;
    for (let t = 0; t < totalTicks; t++) {
      if (shouldDeploy(t, last, diff)) { n++; last = t; }
    }
    return n;
  }
});

describe('pickDeployLocation', () => {
  it('coords в range [0, gridSize-1]', () => {
    const r = pickDeployLocation(60, 60, 0, 'easy', () => 0.5);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x).toBeLessThan(60);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeLessThan(60);
  });

  it('easy игнорирует bias — uniform across grid', () => {
    // random=0.95 means useOpponentArea would be true для normal/hard
    // но easy has opponentBias=0, поэтому всегда uniform
    const r = pickDeployLocation(60, 60, 0, 'easy', () => 0.95);
    // 0.95 * 60 = 57 (uniform). Если бы bias kick'нул — был бы в opp half (≥30).
    // Easy = no bias, expected x = 57 (any position)
    expect(r.x).toBe(57);
  });

  it('hard со slot=0 с bias=true → opp в верхнем-правом квадранте', () => {
    // hard bias=0.85, random=0.5 → useOpp=true (0.5 < 0.85)
    let calls = 0;
    const rng = () => {
      calls++;
      if (calls === 1) return 0.5;  // useOpp = true
      if (calls === 2) return 0.5;  // x mid-range
      return 0.5;                    // y mid-range
    };
    const r = pickDeployLocation(60, 60, 0, 'hard', rng);
    // slot 0 → opp area is (30..59, 30..59)
    expect(r.x).toBeGreaterThanOrEqual(30);
    expect(r.y).toBeGreaterThanOrEqual(30);
  });

  it('hard со slot=1 с bias=true → opp в нижнем-левом квадранте', () => {
    let calls = 0;
    const rng = () => {
      calls++;
      return 0.5;
    };
    const r = pickDeployLocation(60, 60, 1, 'hard', rng);
    expect(r.x).toBeLessThanOrEqual(30);
    expect(r.y).toBeLessThanOrEqual(30);
  });

  it('hard со slot=0 с bias=false → uniform (random > 0.85)', () => {
    // Когда random=0.99, 0.99 < 0.85 is false, поэтому useOpp=false
    let calls = 0;
    const rng = () => {
      calls++;
      if (calls === 1) return 0.99; // useOpp = false
      return 0.5;
    };
    const r = pickDeployLocation(60, 60, 0, 'hard', rng);
    // Uniform — x = floor(0.5 * 60) = 30
    expect(r.x).toBe(30);
  });

  it('normal aggression: 50% opp, 50% uniform', () => {
    // Когда rng=0.3 < 0.5 → useOpp. rng=0.7 → uniform.
    let calls = 0;
    const rng = () => {
      calls++;
      if (calls === 1) return 0.7; // uniform
      return 0.3;
    };
    const r = pickDeployLocation(40, 40, 0, 'normal', rng);
    // 0.3 * 40 = 12 (uniform across [0,39])
    expect(r.x).toBe(12);
  });

  it('small grid (4×4) — coords стабильны', () => {
    const r = pickDeployLocation(4, 4, 0, 'easy', () => 0);
    expect(r).toEqual({ x: 0, y: 0 });
  });

  it('1×1 grid (edge case) — always (0, 0)', () => {
    const r = pickDeployLocation(1, 1, 0, 'easy', () => 0.999);
    expect(r).toEqual({ x: 0, y: 0 });
  });
});

describe('botDisplayName', () => {
  it('format: "🤖 Bot (Easy)" etc', () => {
    expect(botDisplayName('easy')).toBe('🤖 Bot (Easy)');
    expect(botDisplayName('normal')).toBe('🤖 Bot (Normal)');
    expect(botDisplayName('hard')).toBe('🤖 Bot (Hard)');
  });
});

describe('isBotNickname', () => {
  it('true для bot names', () => {
    expect(isBotNickname('🤖 Bot (Easy)')).toBe(true);
    expect(isBotNickname('🤖 anything')).toBe(true);
  });
  it('false для regular names', () => {
    expect(isBotNickname('SilverWolf')).toBe(false);
    expect(isBotNickname('🐺 Wolf')).toBe(false);
    expect(isBotNickname('Bot (Easy)')).toBe(false); // no robot emoji
    expect(isBotNickname('')).toBe(false);
  });
});

// ─── Day 33 smart bot helpers ───────────────────────────────────────────────

describe('shouldDeployJittered', () => {
  it('blocked if same tick (already deployed)', () => {
    expect(shouldDeployJittered(100, 100, 'easy', 5)).toBe(false);
  });

  it('initial burst — первые 3 deploys на shorter interval', () => {
    // Burst interval = 8. Easy = 50. С 0 deploys, ожидаем burst path.
    // currentTick=10, lastDeployTick=0 → 10-0=10 ≥ 8 → true (burst)
    expect(shouldDeployJittered(10, 0, 'easy', 0, false, () => 0.5, 0)).toBe(true);
    // Без burst — 10 < 50 → false
    expect(shouldDeployJittered(10, 0, 'easy', 5, false, () => 0.5, 0)).toBe(false);
  });

  it('panic mode halves interval', () => {
    // Hard interval = 15. Panic = 50% → 7.5 → round to 8 (Math.floor(15*0.5)=7, max(5,7)=7).
    // currentTick=8, lastDeployTick=0 → 8 ≥ 7 → true (panic)
    expect(shouldDeployJittered(8, 0, 'hard', 5, true, () => 0.5, 0)).toBe(true);
    // Без panic: 8 < 15 → false
    expect(shouldDeployJittered(8, 0, 'hard', 5, false, () => 0.5, 0)).toBe(false);
  });

  it('jitter ±20% randomization', () => {
    // Normal = 30. jitterFactor=0.2 → diapason [24, 36] approx.
    // rng=0 → jitter=-0.2 → interval=24. rng=1 → jitter=+0.2 → interval=36.
    expect(shouldDeployJittered(25, 0, 'normal', 5, false, () => 0)).toBe(true);  // 24 ≤ 25
    expect(shouldDeployJittered(25, 0, 'normal', 5, false, () => 1)).toBe(false); // 36 > 25
  });

  it('min interval clamped к 1 tick (защита от divide-by-zero и т.п.)', () => {
    expect(shouldDeployJittered(1, 0, 'easy', 0, false, () => 0, 100)).toBe(true);
  });
});

describe('findFrontierCells', () => {
  it('empty grid → empty result', () => {
    const sim = makeSim(3, 3, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(findFrontierCells(sim, 3, 3, 0, false)).toEqual([]);
  });

  it('all my cells без neighbors → empty', () => {
    // 2×2 grid, все клетки p0 (owner=1) — no frontier
    const sim = makeSim(2, 2, [1, 1, 1, 1]);
    expect(findFrontierCells(sim, 2, 2, 0, false)).toEqual([]);
  });

  it('my cell adjacent к neutral → frontier', () => {
    // 3×3, центр p0, остальное neutral
    const sim = makeSim(3, 3, [0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const r = findFrontierCells(sim, 3, 3, 0, false);
    expect(r).toEqual([{ x: 1, y: 1 }]);
  });

  it('strict enemy mode: только enemy neighbors считаются', () => {
    // p0=1, p1=2, neutral=0. p0 cell в (1,1), enemy в (1,2), neutral elsewhere.
    const sim = makeSim(3, 3, [0, 0, 0, 0, 1, 0, 0, 2, 0]);
    // strictEnemy=true → frontier (1,1) потому что adjacent к (1,2) enemy
    expect(findFrontierCells(sim, 3, 3, 0, true)).toEqual([{ x: 1, y: 1 }]);
  });

  it('strict enemy mode: только neutral neighbors → NOT frontier', () => {
    // p0 cell в (1,1), все neighbors neutral
    const sim = makeSim(3, 3, [0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(findFrontierCells(sim, 3, 3, 0, true)).toEqual([]);
  });

  it('multiple frontier cells', () => {
    // 4×4, левая колонка p0, остальное neutral. Все 4 cells frontier.
    const sim = makeSim(4, 4, [
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
    ]);
    const r = findFrontierCells(sim, 4, 4, 0, false);
    expect(r.length).toBe(4);
    expect(r.map(c => `${c.x},${c.y}`).sort()).toEqual(['0,0', '0,1', '0,2', '0,3']);
  });

  it('mySlotIdx=1 → ищет owner=2', () => {
    const sim = makeSim(3, 3, [0, 0, 0, 0, 2, 0, 0, 0, 0]);
    expect(findFrontierCells(sim, 3, 3, 1, false)).toEqual([{ x: 1, y: 1 }]);
    // p0 perspective — 0 cells (его клеток нет)
    expect(findFrontierCells(sim, 3, 3, 0, false)).toEqual([]);
  });
});

describe('pickSmartDeployLocation', () => {
  it('null sim → fallback на legacy random', () => {
    const cfg = makeConfig(60, 60);
    const r = pickSmartDeployLocation(null, cfg, 0, 'easy', () => 0.5);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x).toBeLessThan(60);
  });

  it('easy → always fallback на legacy (smartProbability=0)', () => {
    const sim = makeSim(2, 2, [0, 0, 0, 1]); // p0 в (1,1) corner
    const cfg = makeConfig(2, 2);
    // Even с perfect sim, easy never smart. Random = 0.99 → first random check выпадает → legacy.
    const r = pickSmartDeployLocation(sim, cfg, 0, 'easy', () => 0.99);
    expect(r).toBeDefined();
  });

  it('hard с frontier cells → picks из frontier когда useSmart=true', () => {
    // 3×3 grid, p0 cell в center adjacent ко всем 4 neutrals → frontier
    const sim = makeSim(3, 3, [0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const cfg = makeConfig(3, 3);
    // RNG sequence: useSmart check (0 < 0.7=true), frontier pick (index 0)
    let calls = 0;
    const rng = () => {
      calls++;
      if (calls === 1) return 0.0; // useSmart = true
      return 0.0; // pick first frontier (index 0)
    };
    const r = pickSmartDeployLocation(sim, cfg, 0, 'hard', rng);
    expect(r).toEqual({ x: 1, y: 1 });
  });

  it('no frontiers → fallback на legacy random', () => {
    // 2×2 all p0 — no frontier
    const sim = makeSim(2, 2, [1, 1, 1, 1]);
    const cfg = makeConfig(2, 2);
    let calls = 0;
    const rng = () => {
      calls++;
      if (calls === 1) return 0.0; // useSmart = true
      return 0.0;
    };
    const r = pickSmartDeployLocation(sim, cfg, 0, 'hard', rng);
    // Falls back to legacy — should return some valid coord
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x).toBeLessThan(2);
  });
});

describe('computeMyTerritoryPercent', () => {
  it('25% если 1 из 4 клеток мой', () => {
    const sim = makeSim(2, 2, [1, 0, 0, 0]);
    expect(computeMyTerritoryPercent(sim, 0, 2, 2)).toBe(25);
  });

  it('100% если все мои', () => {
    const sim = makeSim(2, 2, [1, 1, 1, 1]);
    expect(computeMyTerritoryPercent(sim, 0, 2, 2)).toBe(100);
  });

  it('0% если ничего нет', () => {
    const sim = makeSim(2, 2, [0, 0, 0, 0]);
    expect(computeMyTerritoryPercent(sim, 0, 2, 2)).toBe(0);
  });

  it('mySlotIdx=1 ищет owner=2', () => {
    const sim = makeSim(2, 2, [0, 2, 0, 0]);
    expect(computeMyTerritoryPercent(sim, 1, 2, 2)).toBe(25);
  });
});

describe('isPanicMode', () => {
  it('only hard difficulty trigger panic', () => {
    const sim = makeSim(2, 2, [2, 2, 2, 0]); // opp 75%
    expect(isPanicMode(sim, 0, 2, 2, 'easy')).toBe(false);
    expect(isPanicMode(sim, 0, 2, 2, 'normal')).toBe(false);
    expect(isPanicMode(sim, 0, 2, 2, 'hard')).toBe(true);
  });

  it('panic если opp лидирует на >5%', () => {
    // 100 cells. opp 6, me 0 → opp_pct=6, my=0. delta=6 > 5 → panic
    const data = new Array(100).fill(0);
    for (let i = 0; i < 6; i++) data[i] = 2;
    const sim = makeSim(10, 10, data);
    expect(isPanicMode(sim, 0, 10, 10, 'hard')).toBe(true);
  });

  it('no panic если delta ≤ 5%', () => {
    // 100 cells. opp 5, me 0 → delta=5 → NOT panic
    const data = new Array(100).fill(0);
    for (let i = 0; i < 5; i++) data[i] = 2;
    const sim = makeSim(10, 10, data);
    expect(isPanicMode(sim, 0, 10, 10, 'hard')).toBe(false);
  });

  it('no panic если я лидирую', () => {
    const sim = makeSim(2, 2, [1, 1, 1, 0]); // me 75%
    expect(isPanicMode(sim, 0, 2, 2, 'hard')).toBe(false);
  });

  it('null sim → no panic', () => {
    expect(isPanicMode(null, 0, 60, 60, 'hard')).toBe(false);
  });

  it('wild (owner=255) не считается за opp', () => {
    const sim = makeSim(2, 2, [255, 255, 255, 0]); // 3 wild, 0 opp
    expect(isPanicMode(sim, 0, 2, 2, 'hard')).toBe(false);
  });
});
