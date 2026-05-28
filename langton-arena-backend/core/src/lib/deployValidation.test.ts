// core/src/lib/deployValidation.test.ts

import { describe, it, expect } from 'vitest';
import { canDeploy } from './deployValidation';
import type { SimState } from '../langton/engine';

function makeSim(overrides: Partial<SimState> = {}): SimState {
  const w = 20, h = 20;
  return {
    w, h,
    tick: 0,
    owner: new Uint8Array(w * h),
    state: new Uint8Array(w * h),
    ants: [],
    rng: () => 0,
    seed: 1,
    birthConfig: null,
    collisionCooldownTicks: 5,
    hpEnabled: true,
    damageCapEnabled: true,
    lastBirthTickByOwner: {},
    topology: 'torus',
    ...overrides,
  };
}

describe('canDeploy: bounds + occupancy', () => {
  it('rejects out-of-bounds', () => {
    const sim = makeSim();
    expect(canDeploy(-1, 5, 0, sim, { deployRule: 'anywhere', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Outside the field',
    });
    expect(canDeploy(5, 25, 0, sim, { deployRule: 'anywhere', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Outside the field',
    });
  });

  it('rejects occupied cell', () => {
    const sim = makeSim({
      ants: [{ id: 'a', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 3,
               maxHp: 3, lastDamageTick: -999, bornAt: 0 }],
    });
    expect(canDeploy(5, 5, 1, sim, { deployRule: 'anywhere', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Cell occupied',
    });
  });

  it('does not reject dead ant cell', () => {
    const sim = makeSim({
      ants: [{ id: 'a', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 0,
               maxHp: 3, lastDamageTick: -999, bornAt: 0, dead: true }],
    });
    expect(canDeploy(5, 5, 1, sim, { deployRule: 'anywhere', deployRadius: 3 })).toEqual({
      ok: true,
    });
  });
});

describe('canDeploy: anywhere', () => {
  it('always ok for empty cells in bounds', () => {
    const sim = makeSim();
    expect(canDeploy(0, 0, 0, sim, { deployRule: 'anywhere', deployRadius: 3 })).toEqual({ ok: true });
    expect(canDeploy(10, 10, 5, sim, { deployRule: 'anywhere', deployRadius: 3 })).toEqual({ ok: true });
  });
});

describe('canDeploy: own_territory', () => {
  it('rejects cell not owned by player', () => {
    const sim = makeSim();
    // (5,5) owner=0 (neutral). Player 0 should be rejected.
    expect(canDeploy(5, 5, 0, sim, { deployRule: 'own_territory', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Outside your territory',
    });
  });

  it('accepts cell owned by player', () => {
    const sim = makeSim();
    // owner-grid: owner+1 = playerIdx+1
    sim.owner[5 * 20 + 5] = 1; // player 0
    expect(canDeploy(5, 5, 0, sim, { deployRule: 'own_territory', deployRadius: 3 })).toEqual({
      ok: true,
    });
  });

  it('rejects cell owned by enemy', () => {
    const sim = makeSim();
    sim.owner[5 * 20 + 5] = 2; // player 1
    expect(canDeploy(5, 5, 0, sim, { deployRule: 'own_territory', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Outside your territory',
    });
  });
});

describe('canDeploy: near_alive', () => {
  it('rejects when no own alive ants', () => {
    const sim = makeSim();
    expect(canDeploy(10, 10, 0, sim, { deployRule: 'near_alive', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Too far from your live ants',
    });
  });

  it('accepts within radius of own alive ant', () => {
    const sim = makeSim({
      ants: [{ id: 'a', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3,
               maxHp: 3, lastDamageTick: -999, bornAt: 0 }],
    });
    // (12, 12) is Chebyshev=2 from (10,10) — within radius=3
    expect(canDeploy(12, 12, 0, sim, { deployRule: 'near_alive', deployRadius: 3 })).toEqual({
      ok: true,
    });
  });

  it('rejects beyond radius', () => {
    const sim = makeSim({
      ants: [{ id: 'a', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3,
               maxHp: 3, lastDamageTick: -999, bornAt: 0 }],
    });
    // (15, 15) is Chebyshev=5 from (10,10) — beyond radius=3
    expect(canDeploy(15, 15, 0, sim, { deployRule: 'near_alive', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Too far from your live ants',
    });
  });

  it('ignores enemy alive ants', () => {
    const sim = makeSim({
      ants: [{ id: 'enemy', owner: 1, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3,
               maxHp: 3, lastDamageTick: -999, bornAt: 0 }],
    });
    expect(canDeploy(11, 11, 0, sim, { deployRule: 'near_alive', deployRadius: 3 })).toEqual({
      ok: false, reason: 'Too far from your live ants',
    });
  });

  it('respects torus wrapping', () => {
    const sim = makeSim();
    sim.ants.push({ id: 'a', owner: 0, x: 1, y: 1, dir: 0, rule: 'RL', hp: 3,
                    maxHp: 3, lastDamageTick: -999, bornAt: 0 });
    // (19, 19) — расстояние через torus = (2,2) Chebyshev = 2 < radius=3
    expect(canDeploy(19, 19, 0, sim, { deployRule: 'near_alive', deployRadius: 3 })).toEqual({
      ok: true,
    });
  });
});
