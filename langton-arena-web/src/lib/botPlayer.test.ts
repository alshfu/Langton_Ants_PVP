// src/lib/botPlayer.test.ts
//
// Тесты для pure helper functions BotPlayer.
// Class instance не тестируем (нужен real WS) — это integration territory.

import { describe, it, expect } from 'vitest';
import {
  shouldDeploy, pickDeployLocation,
  botDisplayName, isBotNickname,
} from './botPlayer';

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
