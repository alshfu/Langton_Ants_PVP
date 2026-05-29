// src/lib/computeScoreboard.ts
//
// Stage 8 Day 20: live scoreboard для PvP match.
//
// Pure function — takes SimState + player configs → array of scoreboard
// entries sorted by territory descending. Используется в MatchScreen
// onTick для обновления live UI.
//
// Owner encoding в engine: owner[cell] = playerIdx + 1.
// 0 = neutral (никем не захвачено), 255 = wild (генерированный
// мутацией).

import type { SimState } from '@core/langton/engine';
import { computeCellCountsByOwner } from './computeStats';

export interface ScoreboardEntry {
  /** Player slot index в config.players (0-based). */
  playerIdx: number;
  /** Display name из server-config. */
  name: string;
  /** Hex color из palette. */
  color: string;
  /** Сколько клеток принадлежит этому игроку. */
  cells: number;
  /** Процент от total field (0..100, с 1 десятичной). */
  percent: number;
}

export interface ScoreboardSummary {
  /** Entries отсортированные по cells desc (лидер первый). */
  entries: ScoreboardEntry[];
  /** Сумма клеток у игроков (не считая neutral/wild). */
  totalOwned: number;
  /** Всего клеток в поле. */
  totalCells: number;
  /** Нейтральные (никем не захвачено) клетки. */
  neutralCells: number;
}

/**
 * Compute scoreboard for live PvP match.
 *
 * @param sim Текущее состояние симуляции (с обновлённым owner grid)
 * @param players Конфиг игроков из match
 * @param palette Hex colors игроков (parallel to players array)
 */
export function computeScoreboard(
  sim: SimState,
  players: Array<{ id: string; name: string }>,
  palette: string[],
): ScoreboardSummary {
  const counts = computeCellCountsByOwner(sim);
  const totalCells = sim.owner.length;

  const entries: ScoreboardEntry[] = players.map((p, idx) => {
    const cells = counts[idx + 1] ?? 0;
    const percent = totalCells > 0 ? (cells / totalCells) * 100 : 0;
    return {
      playerIdx: idx,
      name: p.name,
      color: palette[idx] ?? '#888888',
      cells,
      percent: Math.round(percent * 10) / 10,
    };
  });

  const totalOwned = entries.reduce((s, e) => s + e.cells, 0);
  // neutral = owner==0, wild = owner==255. Считаем только neutral как
  // "ничейные" — wild это уже мутация, не нейтрал.
  const neutralCells = counts[0] ?? 0;

  // Sort desc by cells. Stable order для ties — оставляем по playerIdx.
  entries.sort((a, b) => b.cells - a.cells || a.playerIdx - b.playerIdx);

  return { entries, totalOwned, totalCells, neutralCells };
}
