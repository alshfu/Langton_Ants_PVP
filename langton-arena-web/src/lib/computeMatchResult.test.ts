// src/lib/computeMatchResult.test.ts

import { describe, it, expect } from 'vitest';
import { computeMatchResult, describeWinProgress } from './computeMatchResult';
import type { MatchResult, PlayerLiveStats, WinCondition } from '@core/contract/state';

function makeStats(overrides: Partial<PlayerLiveStats> = {}): PlayerLiveStats {
  return {
    alive: 5, born: 0, lost: 0, captures: 0, kills: 0,
    territoryPct: 0.3, cellsOwned: 100,
    mutants: 0, mutantsAlive: 0,
    reserve: 0,
    ...overrides,
  };
}

const empty: MatchResult = {
  finished: false, winnerId: null, winnerName: null,
  reason: '', finishedAtTick: 0, bannerVisible: false,
};

const players = [
  { id: 'p0', name: 'Alpha' },
  { id: 'p1', name: 'Beta' },
  { id: 'p2', name: 'Gamma' },
];

describe('computeMatchResult: none', () => {
  it('never finishes', () => {
    const wc: WinCondition = { kind: 'none', threshold: 5 };
    const result = computeMatchResult({
      currentTick: 99999, winCondition: wc,
      perPlayer: { p0: makeStats(), p1: makeStats() },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(false);
  });
});

describe('computeMatchResult: time', () => {
  it('not finished before threshold', () => {
    const wc: WinCondition = { kind: 'time', threshold: 1000 };
    const result = computeMatchResult({
      currentTick: 500, winCondition: wc,
      perPlayer: { p0: makeStats({ territoryPct: 0.5 }), p1: makeStats({ territoryPct: 0.3 }) },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(false);
  });

  it('finishes at threshold with leader by territory', () => {
    const wc: WinCondition = { kind: 'time', threshold: 100 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ territoryPct: 0.2 }),
        p1: makeStats({ territoryPct: 0.7 }),
        p2: makeStats({ territoryPct: 0.1 }),
      },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(true);
    expect(result.winnerId).toBe('p1');
    expect(result.winnerName).toBe('Beta');
    expect(result.reason).toContain('70.0%');
  });
});

describe('computeMatchResult: first_mutant', () => {
  it('not finished when nobody has mutants', () => {
    const wc: WinCondition = { kind: 'first_mutant', threshold: 1 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: { p0: makeStats(), p1: makeStats() },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(false);
  });

  it('first player with mutant > 0 wins', () => {
    const wc: WinCondition = { kind: 'first_mutant', threshold: 1 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ mutants: 0 }),
        p1: makeStats({ mutants: 1 }),
        p2: makeStats({ mutants: 5 }),
      },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(true);
    expect(result.winnerId).toBe('p1'); // первый по порядку
  });
});

describe('computeMatchResult: n_mutants_total', () => {
  it('not finished when nobody reaches threshold', () => {
    const wc: WinCondition = { kind: 'n_mutants_total', threshold: 5 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ mutants: 3 }),
        p1: makeStats({ mutants: 4 }),
      },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(false);
  });

  it('first player reaching threshold wins', () => {
    const wc: WinCondition = { kind: 'n_mutants_total', threshold: 5 };
    const result = computeMatchResult({
      currentTick: 200, winCondition: wc,
      perPlayer: {
        p0: makeStats({ mutants: 3 }),
        p1: makeStats({ mutants: 5 }),
        p2: makeStats({ mutants: 6 }),
      },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(true);
    expect(result.winnerId).toBe('p1'); // первый в порядке кто >= 5
  });
});

describe('computeMatchResult: n_mutants_single', () => {
  it('checks alive count, not total', () => {
    const wc: WinCondition = { kind: 'n_mutants_single', threshold: 3 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ mutants: 10, mutantsAlive: 2 }),
        p1: makeStats({ mutants: 4, mutantsAlive: 3 }),
      },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(true);
    expect(result.winnerId).toBe('p1');
  });
});

describe('computeMatchResult: survival', () => {
  it('finishes when only one player alive', () => {
    const wc: WinCondition = { kind: 'survival', threshold: 1 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ alive: 0 }),
        p1: makeStats({ alive: 3 }),
        p2: makeStats({ alive: 0 }),
      },
      players, prevMatch: empty,
    });
    expect(result.finished).toBe(true);
    expect(result.winnerId).toBe('p1');
    expect(result.reason).toContain('Last survivor');
  });

  it('finishes with no winner when all dead (draw)', () => {
    const wc: WinCondition = { kind: 'survival', threshold: 1 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ alive: 0 }),
        p1: makeStats({ alive: 0 }),
      },
      players: [{ id: 'p0', name: 'A' }, { id: 'p1', name: 'B' }],
      prevMatch: empty,
    });
    expect(result.finished).toBe(true);
    expect(result.winnerId).toBeNull();
    expect(result.reason).toContain('eliminated');
  });

  it('not finished when 2+ alive', () => {
    const wc: WinCondition = { kind: 'survival', threshold: 1 };
    const result = computeMatchResult({
      currentTick: 100, winCondition: wc,
      perPlayer: {
        p0: makeStats({ alive: 1 }),
        p1: makeStats({ alive: 1 }),
      },
      players: [{ id: 'p0', name: 'A' }, { id: 'p1', name: 'B' }],
      prevMatch: empty,
    });
    expect(result.finished).toBe(false);
  });
});

describe('computeMatchResult: already finished — does not recompute', () => {
  it('returns prev unchanged if finished', () => {
    const prev: MatchResult = {
      finished: true, winnerId: 'p0', winnerName: 'Alpha',
      reason: 'Old reason', finishedAtTick: 50, bannerVisible: false,
    };
    const result = computeMatchResult({
      currentTick: 1000,
      winCondition: { kind: 'first_mutant', threshold: 1 },
      perPlayer: { p0: makeStats(), p1: makeStats({ mutants: 100 }) },
      players, prevMatch: prev,
    });
    // Не пересчитали — вернули prev
    expect(result.winnerId).toBe('p0');
    expect(result.reason).toBe('Old reason');
  });
});

describe('describeWinProgress', () => {
  it('handles all kinds without crash', () => {
    const ps = { p0: makeStats({ mutants: 2, mutantsAlive: 1 }) };
    expect(describeWinProgress({ kind: 'none', threshold: 5 }, ps, players, 100)).toContain('No');
    expect(describeWinProgress({ kind: 'time', threshold: 500 }, ps, players, 100)).toContain('100/500');
    expect(describeWinProgress({ kind: 'first_mutant', threshold: 1 }, ps, players, 100)).toContain('First mutant');
    expect(describeWinProgress({ kind: 'n_mutants_total', threshold: 5 }, ps, players, 100)).toContain('Alpha 2/5');
    expect(describeWinProgress({ kind: 'survival', threshold: 1 }, ps, players, 100)).toContain('alive');
  });
});
