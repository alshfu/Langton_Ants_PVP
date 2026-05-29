// src/lib/matchMilestones.ts
//
// Stage 8 Day 27: detect emotional moments в течение матча.
//
// Pure function detectMilestones(prev, curr, myIdx) возвращает массив
// событий которые сработали при переходе от prev scoreboard'а к curr.
// Caller (MatchScreen) играет stinger sound + показывает MilestoneBanner.
//
// Все thresholds выражены в percent (0..100). Triggering happens на
// **переходе** через threshold, не при удержании. Это значит каждый
// milestone стреляет максимум один раз за матч.

import type { ScoreboardSummary } from './computeScoreboard';

export type MilestoneId =
  | 'crossed_50_up'       // я взял лидерство (percent ≥ 50%)
  | 'crossed_75_up'       // я доминирую (percent ≥ 75%)
  | 'crossed_25_down'     // я в критическом положении (percent < 25%)
  | 'lead_change';        // оппонент обогнал меня ИЛИ я обогнал его

export interface Milestone {
  id: MilestoneId;
  /** Текст для banner overlay. */
  label: string;
  /** Иконка для banner. */
  icon: string;
  /** Цвет theme accent для banner border. */
  accent: 'positive' | 'critical' | 'comeback';
}

const MILESTONE_DEFS: Record<MilestoneId, Omit<Milestone, 'id'>> = {
  crossed_50_up:   { label: 'Taking the lead!',  icon: '🚀', accent: 'positive' },
  crossed_75_up:   { label: 'Dominating!',       icon: '💪', accent: 'positive' },
  crossed_25_down: { label: 'Critical territory!', icon: '⚠️', accent: 'critical' },
  lead_change:     { label: 'Comeback!',         icon: '🔥', accent: 'comeback' },
};

/**
 * Detect какие milestones сработали при переходе prev → curr.
 *
 * Returns пустой массив если:
 * - prev null (первое scoreboard update — нет baseline)
 * - myPlayerIdx null (spectator? в Stage 8 не bывает но safe)
 * - не нашли own/opponent entries в scoreboard
 *
 * Может вернуть **несколько** milestones одновременно — например на одном
 * tick'е сразу crossed_50_up + lead_change если оппонент сильно отступил.
 */
export function detectMilestones(
  prev: ScoreboardSummary | null,
  curr: ScoreboardSummary,
  myPlayerIdx: number | null,
): Milestone[] {
  if (!prev || myPlayerIdx == null) return [];

  const myPrev = prev.entries.find((e) => e.playerIdx === myPlayerIdx);
  const myCurr = curr.entries.find((e) => e.playerIdx === myPlayerIdx);
  if (!myPrev || !myCurr) return [];

  const oppPrev = prev.entries.find((e) => e.playerIdx !== myPlayerIdx);
  const oppCurr = curr.entries.find((e) => e.playerIdx !== myPlayerIdx);

  const events: MilestoneId[] = [];

  // Crossed 50% going up (took lead — pure percentage measure)
  if (myPrev.percent < 50 && myCurr.percent >= 50) {
    events.push('crossed_50_up');
  }
  // Crossed 75% going up (dominating)
  if (myPrev.percent < 75 && myCurr.percent >= 75) {
    events.push('crossed_75_up');
  }
  // Dropped below 25% (was at 25+, now <25 — critical)
  if (myPrev.percent >= 25 && myCurr.percent < 25) {
    events.push('crossed_25_down');
  }
  // Lead change — я был behind, теперь ahead. Использует relative comparison
  // с opponent'ом (не пересечение fixed threshold).
  if (oppPrev && oppCurr) {
    const prevWasBehind = myPrev.percent < oppPrev.percent;
    const nowAhead = myCurr.percent > oppCurr.percent;
    if (prevWasBehind && nowAhead) {
      events.push('lead_change');
    }
  }

  return events.map((id) => ({ id, ...MILESTONE_DEFS[id] }));
}

/** Public reverse-lookup helper (для UI testing). */
export function milestoneLabel(id: MilestoneId): string {
  return MILESTONE_DEFS[id].label;
}
