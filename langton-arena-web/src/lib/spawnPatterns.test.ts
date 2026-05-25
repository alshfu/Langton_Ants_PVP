// src/lib/spawnPatterns.test.ts

import { describe, it, expect } from 'vitest';
import { generateAnts, clampAntsToField } from './spawnPatterns';

describe('generateAnts', () => {
  const baseCtx = {
    playerIndex: 0,
    totalPlayers: 4,
    fieldW: 80,
    fieldH: 60,
    antCount: 3,
    seed: 42,
  };

  it('radial: produces N ants within field bounds', () => {
    const ants = generateAnts('radial', baseCtx);
    expect(ants).toHaveLength(3);
    for (const a of ants) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThan(80);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThan(60);
    }
  });

  it('corner: each player goes to a different corner', () => {
    const p0 = generateAnts('corner', { ...baseCtx, playerIndex: 0, antCount: 1 });
    const p1 = generateAnts('corner', { ...baseCtx, playerIndex: 1, antCount: 1 });
    const p2 = generateAnts('corner', { ...baseCtx, playerIndex: 2, antCount: 1 });
    const p3 = generateAnts('corner', { ...baseCtx, playerIndex: 3, antCount: 1 });
    // 4 разных угла → 4 разных позиции
    const positions = [p0[0], p1[0], p2[0], p3[0]].map((a) => `${a!.x},${a!.y}`);
    expect(new Set(positions).size).toBe(4);
  });

  it('manual: returns empty array', () => {
    expect(generateAnts('manual', baseCtx)).toHaveLength(0);
  });

  it('random: deterministic with same seed', () => {
    const a1 = generateAnts('random', baseCtx);
    const a2 = generateAnts('random', baseCtx);
    expect(a1).toEqual(a2);
  });

  it('random: different seeds give different results', () => {
    const a1 = generateAnts('random', { ...baseCtx, seed: 1 });
    const a2 = generateAnts('random', { ...baseCtx, seed: 2 });
    expect(a1).not.toEqual(a2);
  });

  it('cluster: ants concentrated around player zone', () => {
    const p0 = generateAnts('cluster', { ...baseCtx, playerIndex: 0, antCount: 10 });
    const p2 = generateAnts('cluster', { ...baseCtx, playerIndex: 2, antCount: 10 });
    const avgX0 = p0.reduce((s, a) => s + a.x, 0) / p0.length;
    const avgX2 = p2.reduce((s, a) => s + a.x, 0) / p2.length;
    expect(avgX0).toBeLessThan(avgX2); // зона 0 левее зоны 2
  });

  it('antCount=0 returns empty', () => {
    expect(generateAnts('radial', { ...baseCtx, antCount: 0 })).toHaveLength(0);
  });

  it('ids have correct format', () => {
    const ants = generateAnts('radial', baseCtx);
    for (let i = 0; i < ants.length; i++) {
      expect(ants[i]!.id).toBe(`p0_a${i}`);
    }
  });
});

describe('clampAntsToField', () => {
  it('clamps coords outside field', () => {
    const result = clampAntsToField([
      { id: 'a', x: 150, y: 200, dir: 0, ruleOverride: null },
      { id: 'b', x: -5, y: 30, dir: 0, ruleOverride: null },
    ], 100, 80);
    expect(result.ants[0]!.x).toBe(99);
    expect(result.ants[0]!.y).toBe(79);
    expect(result.ants[1]!.x).toBe(0);
    expect(result.clamped).toBe(2);
  });

  it('does not modify in-bounds ants', () => {
    const result = clampAntsToField([
      { id: 'a', x: 50, y: 30, dir: 0, ruleOverride: null },
    ], 100, 80);
    expect(result.ants[0]!.x).toBe(50);
    expect(result.clamped).toBe(0);
  });
});
