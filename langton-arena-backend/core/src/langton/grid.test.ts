// core/src/langton/grid.test.ts
//
// Stage 8 multi-grid — grid abstraction unit tests.

import { describe, it, expect } from 'vitest';
import { getNeighbors, getNumDirs, applyRuleChar } from './grid';

describe('getNumDirs', () => {
  it('square = 4', () => {
    expect(getNumDirs('square')).toBe(4);
  });
  it('triangle = 3', () => {
    expect(getNumDirs('triangle')).toBe(3);
  });
  it('hexagonal = 6', () => {
    expect(getNumDirs('hexagonal')).toBe(6);
  });
});

describe('getNeighbors — square', () => {
  it('всегда 4 соседа NESW', () => {
    const n = getNeighbors(5, 5, 'square');
    expect(n).toHaveLength(4);
    expect(n[0]).toEqual([0, -1]); // N
    expect(n[1]).toEqual([1, 0]);  // E
    expect(n[2]).toEqual([0, 1]);  // S
    expect(n[3]).toEqual([-1, 0]); // W
  });
  it('независимо от позиции — same set', () => {
    expect(getNeighbors(0, 0, 'square')).toEqual(getNeighbors(99, 99, 'square'));
  });
});

describe('getNeighbors — triangle', () => {
  it('up-triangle (x+y чётно) — соседи left/right/down', () => {
    // (0, 0) → x+y=0 чёт → up
    const n = getNeighbors(0, 0, 'triangle');
    expect(n).toHaveLength(3);
    expect(n[0]).toEqual([-1, 0]); // left
    expect(n[1]).toEqual([1, 0]);  // right
    expect(n[2]).toEqual([0, 1]);  // down
  });
  it('down-triangle (x+y нечётно) — соседи left/right/up', () => {
    // (1, 0) → x+y=1 неч → down
    const n = getNeighbors(1, 0, 'triangle');
    expect(n).toHaveLength(3);
    expect(n[0]).toEqual([-1, 0]); // left
    expect(n[1]).toEqual([1, 0]);  // right
    expect(n[2]).toEqual([0, -1]); // up
  });
  it('чередование up/down по чётности (x+y)', () => {
    // (2, 0) → чёт → up
    expect(getNeighbors(2, 0, 'triangle')[2]).toEqual([0, 1]);  // down neighbor
    // (3, 0) → неч → down
    expect(getNeighbors(3, 0, 'triangle')[2]).toEqual([0, -1]); // up neighbor
    // (0, 1) → неч → down
    expect(getNeighbors(0, 1, 'triangle')[2]).toEqual([0, -1]);
    // (1, 1) → чёт → up
    expect(getNeighbors(1, 1, 'triangle')[2]).toEqual([0, 1]);
  });
});

describe('getNeighbors — hexagonal', () => {
  it('всегда 6 соседей', () => {
    expect(getNeighbors(5, 0, 'hexagonal')).toHaveLength(6);
    expect(getNeighbors(5, 1, 'hexagonal')).toHaveLength(6);
  });
  it('even row (y чётно)', () => {
    const n = getNeighbors(5, 0, 'hexagonal');
    expect(n[0]).toEqual([0, -1]);   // N
    expect(n[3]).toEqual([0, 1]);    // S
  });
  it('odd row offset (y нечётно)', () => {
    const n0 = getNeighbors(5, 0, 'hexagonal');
    const n1 = getNeighbors(5, 1, 'hexagonal');
    // NE отличается: на even = [1, -1], на odd = [1, 0]
    expect(n0[1]).toEqual([1, -1]);
    expect(n1[1]).toEqual([1, 0]);
  });
});

describe('applyRuleChar', () => {
  it('square (numDirs=4): R = +1 mod 4, L = -1 mod 4', () => {
    expect(applyRuleChar(0, 'R', 4)).toBe(1);  // N→E
    expect(applyRuleChar(3, 'R', 4)).toBe(0);  // W→N (wrap)
    expect(applyRuleChar(0, 'L', 4)).toBe(3);  // N→W (wrap)
    expect(applyRuleChar(1, 'L', 4)).toBe(0);  // E→N
  });
  it('square: U = 180° = +2 mod 4', () => {
    expect(applyRuleChar(0, 'U', 4)).toBe(2);  // N→S
    expect(applyRuleChar(1, 'U', 4)).toBe(3);  // E→W
  });
  it('triangle (numDirs=3): R = +1, L = -1 (mod 3, ±120°)', () => {
    expect(applyRuleChar(0, 'R', 3)).toBe(1);
    expect(applyRuleChar(2, 'R', 3)).toBe(0);
    expect(applyRuleChar(0, 'L', 3)).toBe(2);
  });
  it('hexagonal (numDirs=6): R = +1, L = -1 (mod 6, ±60°)', () => {
    expect(applyRuleChar(0, 'R', 6)).toBe(1);
    expect(applyRuleChar(5, 'R', 6)).toBe(0);
    expect(applyRuleChar(0, 'L', 6)).toBe(5);
  });
  it('unknown char → no-op (safety)', () => {
    expect(applyRuleChar(2, 'X', 4)).toBe(2);
    expect(applyRuleChar(2, '?', 4)).toBe(2);
  });
});
