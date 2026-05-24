// services/game-worker/src/deltaComputer.ts
//
// Вычисление дельты между двумя последовательными состояниями симуляции.
// См. backend §4.4 — структура MatchDelta.

import type { SimState } from '@langton/core';

export interface MatchDelta {
  cells: Array<{ x: number; y: number; owner: number; state: number }>;
  ants:  Array<{ id: string; x?: number; y?: number; dir?: number; hp?: number; dead?: boolean }>;
}

export function computeDelta(_prev: SimState, _cur: SimState): MatchDelta {
  // TODO: пройти по owner/state grid, сравнить, выбрать только изменённые ячейки.
  // По муравьям: сравнить по id, выбрать поля которые изменились.
  return { cells: [], ants: [] };
}
