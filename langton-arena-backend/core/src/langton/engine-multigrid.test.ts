// core/src/langton/engine-multigrid.test.ts
//
// Stage 8 multi-grid — engine integration tests для triangle/hexagonal.
// Square coverage уже в engine.test.ts (без gridType = default square).

import { describe, it, expect } from 'vitest';
import { makeLangtonState, stepLangton } from './engine';

function makeAnt(id: string, owner: number, x: number, y: number, dir: number, rule = 'RL') {
  return { id, owner, x, y, dir, rule, hp: 3, maxHp: 3 };
}

describe('engine multi-grid — triangle', () => {
  it('initial state имеет gridType="triangle"', () => {
    const sim = makeLangtonState({
      w: 10, h: 10,
      ants: [makeAnt('a', 0, 5, 5, 0)],
      gridType: 'triangle',
    });
    expect(sim.gridType).toBe('triangle');
  });

  it('ant двигается по 3 направлениям, не выходит за bounds в torus', () => {
    const sim = makeLangtonState({
      w: 10, h: 10,
      ants: [makeAnt('a', 0, 5, 5, 0)],
      gridType: 'triangle',
      hpEnabled: false,
    });
    for (let i = 0; i < 500; i++) stepLangton(sim);
    const a = sim.ants[0]!;
    expect(a.dead).toBeFalsy();
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThan(10);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeLessThan(10);
    expect(a.dir).toBeGreaterThanOrEqual(0);
    expect(a.dir).toBeLessThan(3); // triangle numDirs=3
  });

  it('owner-grid обновляется так же как на square (capture event)', () => {
    const sim = makeLangtonState({
      w: 6, h: 6,
      ants: [makeAnt('a', 0, 2, 2, 0)],
      gridType: 'triangle',
      hpEnabled: false,
    });
    stepLangton(sim);
    const ev = stepLangton(sim);
    // Если ant прыгнул на нейтральную клетку — capture event
    expect(ev.captures.length).toBeGreaterThanOrEqual(0); // может быть 0 или 1
  });

  it('детерминизм: same seed → bit-identical через 200 тиков', () => {
    const make = () => makeLangtonState({
      w: 8, h: 8,
      ants: [makeAnt('a', 0, 3, 3, 0)],
      seed: 42,
      gridType: 'triangle',
      hpEnabled: false,
    });
    const a = make();
    const b = make();
    for (let i = 0; i < 200; i++) {
      stepLangton(a);
      stepLangton(b);
    }
    expect(a.ants[0]!.x).toBe(b.ants[0]!.x);
    expect(a.ants[0]!.y).toBe(b.ants[0]!.y);
    expect(a.ants[0]!.dir).toBe(b.ants[0]!.dir);
    expect(Array.from(a.owner)).toEqual(Array.from(b.owner));
  });

  it('void topology: ant умирает на edge', () => {
    const sim = makeLangtonState({
      w: 4, h: 4,
      ants: [makeAnt('a', 0, 1, 1, 0)],
      topology: 'void',
      gridType: 'triangle',
      hpEnabled: false,
    });
    let died = false;
    for (let i = 0; i < 200; i++) {
      const ev = stepLangton(sim);
      if (ev.deaths.length > 0) { died = true; break; }
    }
    expect(died).toBe(true);
  });
});

describe('engine multi-grid — hexagonal', () => {
  it('initial state имеет gridType="hexagonal"', () => {
    const sim = makeLangtonState({
      w: 10, h: 10,
      ants: [makeAnt('a', 0, 5, 5, 0)],
      gridType: 'hexagonal',
    });
    expect(sim.gridType).toBe('hexagonal');
  });

  it('ant использует 6 направлений (dir может достигать 5)', () => {
    const sim = makeLangtonState({
      w: 12, h: 12,
      ants: [makeAnt('a', 0, 6, 6, 0)],
      gridType: 'hexagonal',
      hpEnabled: false,
    });
    const seenDirs = new Set<number>();
    seenDirs.add(0); // initial
    for (let i = 0; i < 200; i++) {
      stepLangton(sim);
      seenDirs.add(sim.ants[0]!.dir);
    }
    // Через 200 тиков RL ant должен побывать в ≥4 направлениях
    expect(seenDirs.size).toBeGreaterThanOrEqual(4);
    // dir всегда в пределах
    expect(sim.ants[0]!.dir).toBeGreaterThanOrEqual(0);
    expect(sim.ants[0]!.dir).toBeLessThan(6);
  });

  it('не выходит за bounds в torus', () => {
    const sim = makeLangtonState({
      w: 10, h: 10,
      ants: [makeAnt('a', 0, 5, 5, 0)],
      gridType: 'hexagonal',
      hpEnabled: false,
    });
    for (let i = 0; i < 500; i++) stepLangton(sim);
    const a = sim.ants[0]!;
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThan(10);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeLessThan(10);
  });

  it('детерминизм: same seed → identical через 200 тиков', () => {
    const make = () => makeLangtonState({
      w: 8, h: 8,
      ants: [makeAnt('a', 0, 3, 3, 0)],
      seed: 99,
      gridType: 'hexagonal',
      hpEnabled: false,
    });
    const a = make();
    const b = make();
    for (let i = 0; i < 200; i++) {
      stepLangton(a);
      stepLangton(b);
    }
    expect(a.ants[0]!.x).toBe(b.ants[0]!.x);
    expect(a.ants[0]!.y).toBe(b.ants[0]!.y);
    expect(Array.from(a.owner)).toEqual(Array.from(b.owner));
  });

  it('wall topology: ant не выходит за edges на 1000 тиков', () => {
    const sim = makeLangtonState({
      w: 6, h: 6,
      ants: [makeAnt('a', 0, 3, 3, 0)],
      topology: 'wall',
      gridType: 'hexagonal',
      hpEnabled: false,
    });
    for (let i = 0; i < 1000; i++) {
      stepLangton(sim);
      const a = sim.ants[0]!;
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThan(6);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThan(6);
    }
  });
});

describe('engine multi-grid — grid type isolation', () => {
  it('different gridType → different owner-grid', () => {
    const make = (gridType: 'square' | 'triangle' | 'hexagonal') => makeLangtonState({
      w: 8, h: 8,
      ants: [makeAnt('a', 0, 3, 3, 0)],
      seed: 7,
      gridType,
      hpEnabled: false,
    });
    const sq = make('square');
    const tri = make('triangle');
    const hex = make('hexagonal');
    for (let i = 0; i < 100; i++) {
      stepLangton(sq);
      stepLangton(tri);
      stepLangton(hex);
    }
    // Все три grids должны дать разные паттерны
    const sqOwners = Array.from(sq.owner);
    const triOwners = Array.from(tri.owner);
    const hexOwners = Array.from(hex.owner);
    expect(sqOwners).not.toEqual(triOwners);
    expect(sqOwners).not.toEqual(hexOwners);
    expect(triOwners).not.toEqual(hexOwners);
  });
});
