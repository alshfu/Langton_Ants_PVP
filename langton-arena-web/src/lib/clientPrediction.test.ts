// src/lib/clientPrediction.test.ts
//
// Stage 8 Day 10 — тесты для client-side prediction reconciliation helpers.

import { describe, it, expect } from 'vitest';
import {
  makeGhost,
  addGhost,
  reconcileGhosts,
  rejectGhost,
  gcStaleGhosts,
  type Ghost,
} from './clientPrediction';
import type { DeployAction } from '@langton/core';

function g(x: number, y: number, p: number, tick: number = 0): Ghost {
  return {
    id: `g-${x}-${y}-${p}-${tick}`,
    x, y, playerIdx: p,
    sentAtTick: tick,
    sentAtMs: 1_700_000_000_000 + tick,
  };
}

function dep(x: number, y: number, p: number, tick: number = 0): DeployAction {
  return { tick, playerIdx: p, x, y };
}

describe('makeGhost', () => {
  it('id уникален между вызовами', () => {
    const a = makeGhost(1, 1, 0, 5);
    const b = makeGhost(1, 1, 0, 5);
    expect(a.id).not.toBe(b.id);
  });
  it('сохраняет переданные поля', () => {
    const ghost = makeGhost(3, 7, 1, 42, 9999);
    expect(ghost.x).toBe(3);
    expect(ghost.y).toBe(7);
    expect(ghost.playerIdx).toBe(1);
    expect(ghost.sentAtTick).toBe(42);
    expect(ghost.sentAtMs).toBe(9999);
  });
});

describe('addGhost', () => {
  it('добавляет ghost не мутируя оригинал', () => {
    const initial: Ghost[] = [];
    const ghost = g(1, 1, 0);
    const next = addGhost(initial, ghost);
    expect(next).toHaveLength(1);
    expect(initial).toHaveLength(0);
    expect(next[0]).toBe(ghost);
  });
  it('preserve порядок: новый ghost append в конец', () => {
    const a = g(1, 1, 0);
    const b = g(2, 2, 0);
    const next = addGhost(addGhost([], a), b);
    expect(next[0]).toBe(a);
    expect(next[1]).toBe(b);
  });
});

describe('reconcileGhosts', () => {
  it('пустой ghosts → возвращает same reference (no re-render)', () => {
    const ghosts: Ghost[] = [];
    const result = reconcileGhosts(ghosts, [dep(1, 1, 0)]);
    expect(result).toBe(ghosts);
  });
  it('пустой confirmedDeploys → возвращает same reference', () => {
    const ghosts = [g(1, 1, 0)];
    const result = reconcileGhosts(ghosts, []);
    expect(result).toBe(ghosts);
  });
  it('matching deploy убирает ghost по (playerIdx, x, y)', () => {
    const ghosts = [g(1, 1, 0), g(2, 2, 0)];
    const result = reconcileGhosts(ghosts, [dep(1, 1, 0)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.x).toBe(2);
  });
  it('не-matching deploy не трогает ghosts (same reference)', () => {
    const ghosts = [g(1, 1, 0)];
    const result = reconcileGhosts(ghosts, [dep(9, 9, 0)]);
    expect(result).toBe(ghosts);
  });
  it('FIFO при дубликатах: убирает самый ранний matching', () => {
    const earlier = { ...g(5, 5, 0), id: 'earlier' };
    const later = { ...g(5, 5, 0), id: 'later' };
    const result = reconcileGhosts([earlier, later], [dep(5, 5, 0)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('later'); // earlier удалён
  });
  it('matching только по playerIdx: deploy player 0 не убирает ghost player 1', () => {
    const ghosts = [g(1, 1, 1)];
    const result = reconcileGhosts(ghosts, [dep(1, 1, 0)]);
    expect(result).toBe(ghosts);
  });
  it('batch deploys: убирает несколько ghost\'ов в одном вызове', () => {
    const ghosts = [g(1, 1, 0), g(2, 2, 0), g(3, 3, 0)];
    const result = reconcileGhosts(ghosts, [dep(1, 1, 0), dep(3, 3, 0)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.x).toBe(2);
  });
});

describe('rejectGhost', () => {
  it('matching по (x, y, myPlayerIdx) убирает ghost', () => {
    const ghosts = [g(1, 1, 0), g(2, 2, 0)];
    const { ghosts: next, removed } = rejectGhost(ghosts, 0, { x: 1, y: 1 });
    expect(next).toHaveLength(1);
    expect(next[0]!.x).toBe(2);
    expect(removed?.x).toBe(1);
  });
  it('myPlayerIdx=null → no-op', () => {
    const ghosts = [g(1, 1, 0)];
    const { ghosts: next, removed } = rejectGhost(ghosts, null, { x: 1, y: 1 });
    expect(next).toBe(ghosts);
    expect(removed).toBeNull();
  });
  it('context без x → no-op', () => {
    const ghosts = [g(1, 1, 0)];
    const { ghosts: next, removed } = rejectGhost(ghosts, 0, { y: 1 });
    expect(next).toBe(ghosts);
    expect(removed).toBeNull();
  });
  it('не-matching context → no-op (same reference)', () => {
    const ghosts = [g(1, 1, 0)];
    const { ghosts: next, removed } = rejectGhost(ghosts, 0, { x: 9, y: 9 });
    expect(next).toBe(ghosts);
    expect(removed).toBeNull();
  });
  it('пустой ghosts → no-op', () => {
    const result = rejectGhost([], 0, { x: 1, y: 1 });
    expect(result.ghosts).toHaveLength(0);
    expect(result.removed).toBeNull();
  });
});

describe('gcStaleGhosts', () => {
  it('убирает ghost\'ы старше maxAgeTicks', () => {
    const ghosts = [g(1, 1, 0, 10), g(2, 2, 0, 50)];
    const result = gcStaleGhosts(ghosts, 60, 30);
    expect(result).toHaveLength(1);
    expect(result[0]!.sentAtTick).toBe(50);
  });
  it('cutoff inclusive: sentAtTick === currentTick - maxAge остаётся', () => {
    const ghosts = [g(1, 1, 0, 30)];
    const result = gcStaleGhosts(ghosts, 60, 30);
    expect(result).toHaveLength(1);
  });
  it('cutoff exclusive: sentAtTick < currentTick - maxAge удаляется', () => {
    const ghosts = [g(1, 1, 0, 29)];
    const result = gcStaleGhosts(ghosts, 60, 30);
    expect(result).toHaveLength(0);
  });
  it('пустой ghosts → same reference', () => {
    const ghosts: Ghost[] = [];
    expect(gcStaleGhosts(ghosts, 100)).toBe(ghosts);
  });
  it('никаких stale → same reference (no re-render)', () => {
    const ghosts = [g(1, 1, 0, 50)];
    const result = gcStaleGhosts(ghosts, 60, 30);
    expect(result).toBe(ghosts);
  });
  it('default maxAge = 30', () => {
    const ghosts = [g(1, 1, 0, 0), g(2, 2, 0, 31)];
    const result = gcStaleGhosts(ghosts, 31);
    expect(result).toHaveLength(1);
    expect(result[0]!.sentAtTick).toBe(31);
  });
});

describe('integration: full lifecycle', () => {
  it('click → match_tick confirm → ghost removed', () => {
    let ghosts: Ghost[] = [];
    const ghost = makeGhost(5, 5, 0, 100);
    ghosts = addGhost(ghosts, ghost);
    expect(ghosts).toHaveLength(1);

    ghosts = reconcileGhosts(ghosts, [dep(5, 5, 0)]);
    expect(ghosts).toHaveLength(0);
  });

  it('click → INVALID_DEPLOY error → ghost rolled back', () => {
    let ghosts: Ghost[] = [];
    ghosts = addGhost(ghosts, makeGhost(7, 7, 0, 50));
    const { ghosts: next, removed } = rejectGhost(ghosts, 0, { x: 7, y: 7, tick: 50 });
    expect(next).toHaveLength(0);
    expect(removed?.x).toBe(7);
  });

  it('click → no echo for 30+ ticks → GC removes', () => {
    let ghosts: Ghost[] = [];
    ghosts = addGhost(ghosts, makeGhost(3, 3, 0, 100));
    ghosts = gcStaleGhosts(ghosts, 131, 30);
    expect(ghosts).toHaveLength(0);
  });

  it('multiple pending → partial confirm → only matching removed', () => {
    let ghosts: Ghost[] = [];
    ghosts = addGhost(ghosts, makeGhost(1, 1, 0, 10));
    ghosts = addGhost(ghosts, makeGhost(2, 2, 0, 11));
    ghosts = addGhost(ghosts, makeGhost(3, 3, 0, 12));

    ghosts = reconcileGhosts(ghosts, [dep(2, 2, 0)]);
    expect(ghosts).toHaveLength(2);
    expect(ghosts.map((g) => g.x).sort()).toEqual([1, 3]);
  });
});
