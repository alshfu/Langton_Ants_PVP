// src/lib/computeStats.ts
//
// Чистые функции для подсчёта статистики из SimState.
// Используются в SandboxScreen в onTick для sample-обновления territoryHistory.

import type { SimState } from '@core/langton/engine';

/**
 * Подсчитать сколько клеток у каждого owner (включая wild=255 и neutral=0).
 * Возвращает массив длины 256 (owner index → cellCount).
 *
 * Используем массив а не Map — на горячем пути это в разы быстрее.
 */
export function computeCellCountsByOwner(sim: SimState): Uint32Array {
  const counts = new Uint32Array(256);
  const owner = sim.owner;
  const len = owner.length;
  for (let i = 0; i < len; i++) {
    counts[owner[i]!]!++;
  }
  return counts;
}

/**
 * Подсчитать сколько живых муравьёв у каждого owner.
 */
export function computeAliveAntsByOwner(sim: SimState): Map<number, number> {
  const map = new Map<number, number>();
  for (const a of sim.ants) {
    if (a.dead) continue;
    map.set(a.owner, (map.get(a.owner) ?? 0) + 1);
  }
  return map;
}
