// src/lib/computeScoreboard.test.ts

import { describe, it, expect } from 'vitest';
import { computeScoreboard } from './computeScoreboard';
import type { SimState } from '@core/langton/engine';

/**
 * Helper: build minimal SimState с заданной owner grid.
 * Engine owner encoding: 0 = neutral, idx+1 = player, 255 = wild.
 */
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

describe('computeScoreboard', () => {
  const players = [
    { id: 'p0', name: 'Alice' },
    { id: 'p1', name: 'Bob' },
  ];
  const palette = ['#FF0000', '#00FF00'];

  it('all cells neutral → both players have 0', () => {
    const sim = makeSim(2, 2, [0, 0, 0, 0]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.totalCells).toBe(4);
    expect(sb.totalOwned).toBe(0);
    expect(sb.neutralCells).toBe(4);
    expect(sb.entries.map(e => e.cells)).toEqual([0, 0]);
  });

  it('p0 owns 3, p1 owns 1 → p0 leader', () => {
    // owner[0]=1 (p0), [1]=1 (p0), [2]=1 (p0), [3]=2 (p1)
    const sim = makeSim(2, 2, [1, 1, 1, 2]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.entries[0]!.playerIdx).toBe(0);
    expect(sb.entries[0]!.name).toBe('Alice');
    expect(sb.entries[0]!.cells).toBe(3);
    expect(sb.entries[0]!.percent).toBe(75);
    expect(sb.entries[1]!.playerIdx).toBe(1);
    expect(sb.entries[1]!.cells).toBe(1);
    expect(sb.entries[1]!.percent).toBe(25);
  });

  it('sorts entries descending by cells', () => {
    // p1 owns more
    const sim = makeSim(4, 1, [2, 2, 1, 0]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.entries[0]!.playerIdx).toBe(1);
    expect(sb.entries[0]!.cells).toBe(2);
    expect(sb.entries[1]!.playerIdx).toBe(0);
    expect(sb.entries[1]!.cells).toBe(1);
  });

  it('stable sort for ties: preserves playerIdx order', () => {
    // Equal cells
    const sim = makeSim(2, 1, [1, 2]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.entries[0]!.playerIdx).toBe(0);
    expect(sb.entries[1]!.playerIdx).toBe(1);
  });

  it('attaches palette colors correctly', () => {
    const sim = makeSim(2, 1, [1, 2]);
    const sb = computeScoreboard(sim, players, palette);
    const alice = sb.entries.find(e => e.name === 'Alice')!;
    const bob = sb.entries.find(e => e.name === 'Bob')!;
    expect(alice.color).toBe('#FF0000');
    expect(bob.color).toBe('#00FF00');
  });

  it('handles missing palette entry — gracefully falls back to grey', () => {
    const sim = makeSim(1, 1, [1]);
    const sb = computeScoreboard(sim, players, ['#FF0000']); // только 1 цвет
    expect(sb.entries.find(e => e.name === 'Bob')!.color).toBe('#888888');
  });

  it('rounds percent to 1 decimal', () => {
    // 1 cell out of 3 = 33.333...%
    const sim = makeSim(3, 1, [1, 0, 0]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.entries[0]!.percent).toBe(33.3);
  });

  it('wild cells (owner=255) not attributed to any player', () => {
    // 1 cell wild, 1 cell p0, 2 cells neutral
    const sim = makeSim(2, 2, [255, 1, 0, 0]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.entries.find(e => e.name === 'Alice')!.cells).toBe(1);
    expect(sb.entries.find(e => e.name === 'Bob')!.cells).toBe(0);
    expect(sb.neutralCells).toBe(2);
    expect(sb.totalOwned).toBe(1);
  });

  it('large grid 60×60 typical PvP scenario', () => {
    // First quarter owned by p0, rest neutral
    const w = 60, h = 60;
    const data = new Array(w * h).fill(0);
    for (let i = 0; i < 900; i++) data[i] = 1;
    const sim = makeSim(w, h, data);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.totalCells).toBe(3600);
    expect(sb.entries[0]!.cells).toBe(900);
    expect(sb.entries[0]!.percent).toBe(25);
    expect(sb.neutralCells).toBe(2700);
  });

  it('totalOwned does not include neutral or wild', () => {
    const sim = makeSim(4, 1, [1, 2, 0, 255]);
    const sb = computeScoreboard(sim, players, palette);
    expect(sb.totalOwned).toBe(2); // только p0 + p1
    expect(sb.neutralCells).toBe(1);
  });

  it('handles 3+ players (Stage 9 preview)', () => {
    const threePlayers = [
      { id: 'p0', name: 'A' },
      { id: 'p1', name: 'B' },
      { id: 'p2', name: 'C' },
    ];
    const threePalette = ['#F00', '#0F0', '#00F'];
    const sim = makeSim(3, 1, [1, 2, 3]);
    const sb = computeScoreboard(sim, threePlayers, threePalette);
    expect(sb.entries).toHaveLength(3);
    expect(sb.entries.map(e => e.cells)).toEqual([1, 1, 1]);
    expect(sb.entries.map(e => e.percent)).toEqual([33.3, 33.3, 33.3]);
  });
});
