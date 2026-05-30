// core/src/lib/holdMajority.test.ts

import { describe, it, expect } from 'vitest';
import { holdMajorityTick } from './holdMajority.js';
import type { SimState } from '../langton/engine.js';

function makeSim(width: number, height: number, ownerData: number[]): Pick<SimState, 'owner'> {
  return { owner: new Uint8Array(ownerData) };
}

const players = [
  { id: 'p0', name: 'Alpha' },
  { id: 'p1', name: 'Beta' },
];

describe('holdMajorityTick', () => {
  it('никто не выше threshold → counters=0, no winner', () => {
    const sim = makeSim(2, 2, [1, 0, 0, 0]); // p0 25%
    const r = holdMajorityTick(sim, players, 50, 100, {});
    expect(r.counters).toEqual({ p0: 0, p1: 0 });
    expect(r.winnerIdx).toBeNull();
  });

  it('первый tick выше threshold → counter=1', () => {
    const sim = makeSim(2, 2, [1, 1, 1, 0]); // p0 75%
    const r = holdMajorityTick(sim, players, 50, 100, {});
    expect(r.counters.p0).toBe(1);
    expect(r.counters.p1).toBe(0);
    expect(r.winnerIdx).toBeNull();
  });

  it('accumulates через consecutive ticks', () => {
    const sim = makeSim(2, 2, [1, 1, 1, 0]); // p0 75%
    let counters: Record<string, number> = {};
    for (let t = 0; t < 5; t++) {
      const r = holdMajorityTick(sim, players, 50, 100, counters);
      counters = r.counters;
    }
    expect(counters.p0).toBe(5);
    expect(counters.p1).toBe(0);
  });

  it('reset на падение ниже threshold', () => {
    // p0 был на 75% counter=5. Теперь упал до 25%.
    const sim = makeSim(2, 2, [1, 0, 0, 0]); // p0 25%
    const r = holdMajorityTick(sim, players, 50, 100, { p0: 5, p1: 0 });
    expect(r.counters.p0).toBe(0);
  });

  it('winner когда counter достигает holdTicks', () => {
    const sim = makeSim(2, 2, [1, 1, 1, 0]); // p0 75%
    const r = holdMajorityTick(sim, players, 50, 10, { p0: 9, p1: 0 });
    expect(r.counters.p0).toBe(10);
    expect(r.winnerIdx).toBe(0);
  });

  it('threshold 50% triggers ровно на 50%', () => {
    const sim = makeSim(2, 2, [1, 1, 0, 0]); // p0 50%
    const r = holdMajorityTick(sim, players, 50, 100, {});
    expect(r.counters.p0).toBe(1);
  });

  it('ties: оба >threshold — первый по indexу wins', () => {
    const three = [
      { id: 'p0', name: 'A' }, { id: 'p1', name: 'B' }, { id: 'p2', name: 'C' },
    ];
    // 4 cells. p0=1, p1=1, p2=0. threshold=25 → оба >=25.
    const sim = makeSim(2, 2, [1, 2, 0, 0]);
    const r = holdMajorityTick(sim, three, 25, 1, {});
    // Both p0 и p1 reach holdTicks=1 → winner = p0 (first index)
    expect(r.winnerIdx).toBe(0);
  });

  it('ignores wild (owner=255) для territory calc', () => {
    const sim = makeSim(2, 2, [255, 0, 0, 1]); // wild, neutral, neutral, p0 → p0 = 25%
    const r = holdMajorityTick(sim, players, 50, 100, {});
    expect(r.counters.p0).toBe(0); // не выше 50%
  });
});
