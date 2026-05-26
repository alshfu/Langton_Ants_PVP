// src/lib/computeHighlights.ts
//
// 5 алгоритмов для извлечения «highlights» из live-данных симуляции.
// Все чистые функции, легко тестируются.
//
// Используются в SandboxScreen в onTick раз в 50 тиков (не каждый — слишком часто).
// Результат пушится в liveStats.highlights и отображается в StatsTab.

import type { LogEvent, Highlight, SandboxLiveStats } from '@core/contract/state';

interface PlayerRef {
  id: string;
  name: string;
}

interface HeatmapSnapshot {
  w: number;
  h: number;
  contested: Uint32Array;
  maxContested: number;
}

/**
 * Самая длинная цепочка тиков без событий type='death'.
 * Если смертей пока нет — возвращает null (highlight ещё не имеет смысла).
 */
export function computeLongestStreak(
  events: LogEvent[],
  currentTick: number,
): Highlight | null {
  const deathTicks = events
    .filter((e) => e.type === 'death')
    .map((e) => e.tick)
    .sort((a, b) => a - b);

  if (deathTicks.length === 0) return null;

  // От tick=0 до первой смерти
  let maxStreak = deathTicks[0]!;
  let streakStart = 0;
  let streakEnd = deathTicks[0]!;

  // Между смертями
  for (let i = 1; i < deathTicks.length; i++) {
    const streak = deathTicks[i]! - deathTicks[i - 1]!;
    if (streak > maxStreak) {
      maxStreak = streak;
      streakStart = deathTicks[i - 1]!;
      streakEnd = deathTicks[i]!;
    }
  }

  // От последней смерти до текущего тика — может быть текущий streak длиннее
  const currentStreak = currentTick - deathTicks[deathTicks.length - 1]!;
  if (currentStreak > maxStreak) {
    maxStreak = currentStreak;
    streakStart = deathTicks[deathTicks.length - 1]!;
    streakEnd = currentTick;
  }

  return {
    id: 'longest_streak',
    type: 'longest_streak',
    tickStart: streakStart,
    tickEnd: streakEnd,
    title: 'Longest streak without deaths',
    description: `${maxStreak} ticks · from t${streakStart} to t${streakEnd}`,
    value: maxStreak,
  };
}

/**
 * Наивысший % территории, который один игрок достиг за всё время.
 * Использует territoryHistory из liveStats.
 */
export function computePeakTerritory(
  history: SandboxLiveStats['territoryHistory'],
  players: PlayerRef[],
): Highlight | null {
  let peak = 0;
  let peakTick = 0;
  let peakPlayerId = '';

  for (const pt of history) {
    for (const [pid, pct] of Object.entries(pt.byPlayer)) {
      if (pct > peak) {
        peak = pct;
        peakTick = pt.tick;
        peakPlayerId = pid;
      }
    }
  }

  if (peak === 0) return null;

  const player = players.find((p) => p.id === peakPlayerId);
  const playerName = player?.name ?? '?';
  const playerIdx = players.findIndex((p) => p.id === peakPlayerId);

  return {
    id: 'peak_territory',
    type: 'peak_territory',
    tickStart: peakTick,
    title: 'Peak territory',
    description: `${playerName} reached ${(peak * 100).toFixed(1)}% at t${peakTick}`,
    ownerIdx: playerIdx >= 0 ? playerIdx : undefined,
    value: peak,
  };
}

/**
 * Клетка где было максимум clash-событий.
 * Использует contested heatmap.
 */
export function computeBiggestFight(heatmap: HeatmapSnapshot): Highlight | null {
  if (heatmap.maxContested === 0) return null;

  // Найти первую клетку с max значением
  // (потенциально могут быть равные — берём first для детерминизма)
  let bestX = 0, bestY = 0;
  for (let y = 0; y < heatmap.h; y++) {
    for (let x = 0; x < heatmap.w; x++) {
      if (heatmap.contested[y * heatmap.w + x] === heatmap.maxContested) {
        bestX = x;
        bestY = y;
        // Берём first — break из обоих циклов
        y = heatmap.h;
        break;
      }
    }
  }

  return {
    id: 'biggest_fight',
    type: 'biggest_fight',
    tickStart: 0, // нет конкретного tick — этот highlight о месте, не моменте
    title: 'Biggest fight zone',
    description: `(${bestX}, ${bestY}) — ${heatmap.maxContested} clashes`,
    value: heatmap.maxContested,
    x: bestX,
    y: bestY,
  };
}

/**
 * Первое событие type='death'.
 * Принимает кэшированный first-death (из firstDeathRef) для оптимизации,
 * иначе сканирует events.
 */
export function computeFirstDeath(
  cachedFirstDeath: LogEvent | null,
  events: LogEvent[],
  players: PlayerRef[],
): Highlight | null {
  const first = cachedFirstDeath ?? events.find((e) => e.type === 'death');
  if (!first) return null;

  const player = first.ownerIdx >= 0 && first.ownerIdx < players.length
    ? players[first.ownerIdx]
    : null;
  const playerName = player?.name ?? '?';

  return {
    id: 'first_death',
    type: 'first_death',
    tickStart: first.tick,
    title: 'First death',
    description: `${playerName} ant died at t${first.tick} @(${first.x},${first.y})`,
    ownerIdx: first.ownerIdx >= 0 ? first.ownerIdx : undefined,
    value: first.tick,
    x: first.x,
    y: first.y,
  };
}

/**
 * Clash с максимумом deaths в одной клетке в одном тике.
 * Группирует death events по (tick, x, y), берёт группу с max размером.
 */
export function computeMostKillsInClash(events: LogEvent[]): Highlight | null {
  const clashGroups = new Map<string, { count: number; tick: number; x: number; y: number }>();
  for (const e of events) {
    if (e.type !== 'death') continue;
    const key = `${e.tick}|${e.x}|${e.y}`;
    const g = clashGroups.get(key) ?? { count: 0, tick: e.tick, x: e.x, y: e.y };
    g.count++;
    clashGroups.set(key, g);
  }

  let best: { count: number; tick: number; x: number; y: number } | null = null;
  for (const g of clashGroups.values()) {
    if (!best || g.count > best.count) best = g;
  }

  if (!best || best.count < 2) return null;

  return {
    id: 'most_kills_clash',
    type: 'most_kills_clash',
    tickStart: best.tick,
    title: 'Most kills in single clash',
    description: `${best.count} ants killed at t${best.tick} @(${best.x},${best.y})`,
    value: best.count,
    x: best.x,
    y: best.y,
  };
}

/**
 * Главная функция — считает все 5 highlights одновременно.
 * Возвращает массив (не-null). Используется в SandboxScreen.
 */
export function computeAllHighlights(args: {
  events: LogEvent[];
  cachedFirstDeath: LogEvent | null;
  history: SandboxLiveStats['territoryHistory'];
  players: PlayerRef[];
  heatmap: HeatmapSnapshot;
  currentTick: number;
}): Highlight[] {
  const result: Highlight[] = [];
  const a = computeLongestStreak(args.events, args.currentTick);
  if (a) result.push(a);
  const b = computePeakTerritory(args.history, args.players);
  if (b) result.push(b);
  const c = computeBiggestFight(args.heatmap);
  if (c) result.push(c);
  const d = computeFirstDeath(args.cachedFirstDeath, args.events, args.players);
  if (d) result.push(d);
  const e = computeMostKillsInClash(args.events);
  if (e) result.push(e);
  return result;
}
