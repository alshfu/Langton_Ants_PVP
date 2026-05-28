// core/src/lib/computeTerritory.test.ts

import { describe, it, expect } from 'vitest';
import { computeTerritory, computeWinnerByTerritory, type PlayerRef } from './computeTerritory';

function mkSim(owners: number[]): { owner: Uint8Array } {
  return { owner: new Uint8Array(owners) };
}

const PLAYERS: PlayerRef[] = [
  { id: 'p0', name: 'Alice' },
  { id: 'p1', name: 'Bob' },
];

describe('computeTerritory', () => {
  it('пустой field → 0 cells для всех', () => {
    const sim = mkSim([0, 0, 0, 0]);
    const t = computeTerritory(sim, PLAYERS);
    expect(t[0]!.cells).toBe(0);
    expect(t[1]!.cells).toBe(0);
    expect(t[0]!.pct).toBe(0);
  });

  it('owner=1 → player0, owner=2 → player1', () => {
    const sim = mkSim([1, 1, 2, 0]); // 2 для p0, 1 для p1, 1 нейтральная
    const t = computeTerritory(sim, PLAYERS);
    expect(t[0]!.cells).toBe(2);
    expect(t[1]!.cells).toBe(1);
    expect(t[0]!.pct).toBe(0.5);
    expect(t[1]!.pct).toBe(0.25);
  });

  it('preserve порядок players', () => {
    const sim = mkSim([2, 2, 2, 1]);
    const t = computeTerritory(sim, PLAYERS);
    expect(t[0]!.playerId).toBe('p0');
    expect(t[1]!.playerId).toBe('p1');
  });

  it('игнорирует owner за пределами players[]', () => {
    const sim = mkSim([5, 1, 2, 0]); // 5 — invalid, не считается
    const t = computeTerritory(sim, PLAYERS);
    expect(t[0]!.cells).toBe(1);
    expect(t[1]!.cells).toBe(1);
  });
});

describe('computeWinnerByTerritory', () => {
  it('player0 имеет больше cells → winner', () => {
    const sim = mkSim([1, 1, 1, 2]);
    const r = computeWinnerByTerritory(sim, PLAYERS);
    expect(r.winnerIdx).toBe(0);
    expect(r.territory[0]!.playerId).toBe('p0');
    expect(r.territory[0]!.cells).toBe(3);
  });

  it('player1 больше → winner = 1', () => {
    const sim = mkSim([1, 2, 2, 2]);
    const r = computeWinnerByTerritory(sim, PLAYERS);
    expect(r.winnerIdx).toBe(1);
  });

  it('ничья → winnerIdx = null', () => {
    const sim = mkSim([1, 1, 2, 2]);
    const r = computeWinnerByTerritory(sim, PLAYERS);
    expect(r.winnerIdx).toBeNull();
    expect(r.territory[0]!.cells).toBe(2);
    expect(r.territory[1]!.cells).toBe(2);
  });

  it('никаких captures (все нейтральные) → ничья', () => {
    const sim = mkSim([0, 0, 0, 0]);
    const r = computeWinnerByTerritory(sim, PLAYERS);
    expect(r.winnerIdx).toBeNull();
  });

  it('territory отсортирован desc by cells', () => {
    const sim = mkSim([2, 2, 2, 1]);
    const r = computeWinnerByTerritory(sim, PLAYERS);
    expect(r.territory[0]!.cells).toBeGreaterThan(r.territory[1]!.cells);
    expect(r.territory[0]!.playerId).toBe('p1');
  });

  it('3+ players: только один лидер → выигрывает', () => {
    const three: PlayerRef[] = [
      { id: 'p0', name: 'A' },
      { id: 'p1', name: 'B' },
      { id: 'p2', name: 'C' },
    ];
    const sim = mkSim([1, 1, 1, 2, 3]); // p0:3 p1:1 p2:1
    const r = computeWinnerByTerritory(sim, three);
    expect(r.winnerIdx).toBe(0);
    expect(r.territory[0]!.cells).toBe(3);
  });
});
