// core/src/lib/holdMajority.ts
//
// Stage 8 Day 35: hold_majority server-side helper.
//
// Shared между server's Match и client's computeMatchResult — pure function,
// никакого state. Caller хранит counters Record<playerId, number> и
// передаёт prev на каждом tick.
//
// Semantics: за каждый tick где territoryPct >= thresholdPct counter
// инкрементируется. Если упал ниже — reset в 0. Первый кто достиг
// holdTicks → winner.

import type { SimState } from '../langton/engine.js';
import { computeTerritory } from './computeTerritory.js';

export interface PlayerRef {
  id: string;
  name: string;
}

export interface HoldCheckResult {
  /** Обновлённые counters после этого tick'а. */
  counters: Record<string, number>;
  /** Если кто-то достиг holdTicks — его playerIdx. Иначе null. */
  winnerIdx: number | null;
}

/**
 * Один tick: обновляет counters и проверяет winner.
 *
 * @param sim simulation state (для подсчёта territory)
 * @param players player references
 * @param thresholdPct процент 0..100 (e.g. 50 для majority)
 * @param holdTicks сколько consecutive ticks нужно удержать
 * @param prevCounters предыдущие counters (Record<playerId, number>)
 */
export function holdMajorityTick(
  sim: Pick<SimState, 'owner'>,
  players: readonly PlayerRef[],
  thresholdPct: number,
  holdTicks: number,
  prevCounters: Record<string, number>,
): HoldCheckResult {
  const territory = computeTerritory(sim, players);
  const newCounters: Record<string, number> = {};

  // Update counters per player
  for (const t of territory) {
    const pct = t.pct * 100;
    if (pct >= thresholdPct) {
      newCounters[t.playerId] = (prevCounters[t.playerId] ?? 0) + 1;
    } else {
      newCounters[t.playerId] = 0;
    }
  }

  // Find winner — первый достигший holdTicks
  let winnerIdx: number | null = null;
  let bestCount = -1;
  for (let idx = 0; idx < players.length; idx++) {
    const p = players[idx]!;
    const c = newCounters[p.id] ?? 0;
    if (c >= holdTicks && c > bestCount) {
      bestCount = c;
      winnerIdx = idx;
    }
  }

  return { counters: newCounters, winnerIdx };
}
