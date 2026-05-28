// core/src/lib/computeTerritory.ts
//
// Stage 8 Day 11 — расчёт территории по sim.owner: shared между server
// (для match result) и client (для возможного отображения live).
//
// owner: Uint8Array of length w*h. 0 = нейтральная, 1+ = playerIdx + 1.
// Cells неинтересны конкретно — нас интересует aggregate per player.

import type { SimState } from '../langton/engine.js';

export interface TerritoryEntry {
  playerId: string;
  playerName: string;
  cells: number;
  pct: number; // 0..1
}

export interface PlayerRef {
  id: string;
  name: string;
}

/**
 * Подсчёт клеток по владельцу. Возвращает entries в порядке players[] —
 * caller sortирует если нужно.
 */
export function computeTerritory(
  sim: Pick<SimState, 'owner'>,
  players: readonly PlayerRef[],
): TerritoryEntry[] {
  const counts = new Array(players.length).fill(0);
  const owner = sim.owner;
  for (let i = 0; i < owner.length; i++) {
    const o = owner[i]!;
    if (o > 0 && o - 1 < counts.length) counts[o - 1]++;
  }
  const total = owner.length;
  return players.map((p, idx) => ({
    playerId: p.id,
    playerName: p.name,
    cells: counts[idx]!,
    pct: total > 0 ? counts[idx]! / total : 0,
  }));
}

/**
 * Определить победителя по территории. При ничьей (равные cells) возвращает
 * winnerIdx = null. Возвращает territory отсортированный desc by cells.
 */
export function computeWinnerByTerritory(
  sim: Pick<SimState, 'owner'>,
  players: readonly PlayerRef[],
): { winnerIdx: number | null; territory: TerritoryEntry[] } {
  const t = computeTerritory(sim, players);
  // Sort by cells desc, при равенстве — playerIdx asc (для стабильности)
  const sorted = [...t].sort((a, b) => {
    if (b.cells !== a.cells) return b.cells - a.cells;
    return players.findIndex((p) => p.id === a.playerId)
         - players.findIndex((p) => p.id === b.playerId);
  });
  // Tie: первые двое имеют одинаковый cells → winnerIdx = null
  if (sorted.length >= 2 && sorted[0]!.cells === sorted[1]!.cells) {
    return { winnerIdx: null, territory: sorted };
  }
  const winnerIdx = players.findIndex((p) => p.id === sorted[0]?.playerId);
  return { winnerIdx: winnerIdx >= 0 ? winnerIdx : null, territory: sorted };
}
