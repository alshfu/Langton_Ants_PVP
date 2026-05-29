// src/lib/matchMilestones.test.ts

import { describe, it, expect } from 'vitest';
import { detectMilestones, milestoneLabel } from './matchMilestones';
import type { ScoreboardSummary } from './computeScoreboard';

/** Helper: build scoreboard с двумя players и заданными percent. */
function sb(myPercent: number, oppPercent: number): ScoreboardSummary {
  return {
    entries: [
      { playerIdx: 0, name: 'Me',  color: '#F00', cells: myPercent * 36, percent: myPercent, antsAlive: 5 },
      { playerIdx: 1, name: 'Opp', color: '#0F0', cells: oppPercent * 36, percent: oppPercent, antsAlive: 5 },
    ],
    totalOwned: (myPercent + oppPercent) * 36,
    totalCells: 3600,
    neutralCells: (100 - myPercent - oppPercent) * 36,
  };
}

describe('detectMilestones', () => {
  it('null prev → empty', () => {
    expect(detectMilestones(null, sb(50, 50), 0)).toEqual([]);
  });

  it('null myPlayerIdx → empty', () => {
    expect(detectMilestones(sb(40, 60), sb(50, 50), null)).toEqual([]);
  });

  it('cross 50 up → crossed_50_up', () => {
    const ms = detectMilestones(sb(48, 30), sb(52, 28), 0);
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.find((m) => m.id === 'crossed_50_up')).toBeTruthy();
  });

  it('cross 50 up на ровно 50% триггерит', () => {
    const ms = detectMilestones(sb(49, 30), sb(50, 30), 0);
    expect(ms.find((m) => m.id === 'crossed_50_up')).toBeTruthy();
  });

  it('cross 75 up → crossed_75_up', () => {
    const ms = detectMilestones(sb(74, 20), sb(76, 18), 0);
    expect(ms.find((m) => m.id === 'crossed_75_up')).toBeTruthy();
  });

  it('cross 25 down → crossed_25_down', () => {
    const ms = detectMilestones(sb(27, 60), sb(24, 65), 0);
    expect(ms.find((m) => m.id === 'crossed_25_down')).toBeTruthy();
  });

  it('lead change оппонент → я ahead = lead_change', () => {
    const ms = detectMilestones(sb(40, 50), sb(52, 38), 0);
    expect(ms.find((m) => m.id === 'lead_change')).toBeTruthy();
  });

  it('держусь в лидерстве (всегда был ahead) → нет lead_change', () => {
    const ms = detectMilestones(sb(60, 30), sb(65, 25), 0);
    expect(ms.find((m) => m.id === 'lead_change')).toBeFalsy();
  });

  it('падение из лидерства (был ahead, теперь behind) → нет lead_change (это его lead change)', () => {
    const ms = detectMilestones(sb(60, 40), sb(45, 55), 0);
    expect(ms.find((m) => m.id === 'lead_change')).toBeFalsy();
  });

  it('multiple milestones одновременно: crossed_50 + lead_change', () => {
    // Я был на 48% behind opp (52). Теперь на 52% ahead opp (40).
    const ms = detectMilestones(sb(48, 52), sb(52, 40), 0);
    expect(ms.map((m) => m.id)).toContain('crossed_50_up');
    expect(ms.map((m) => m.id)).toContain('lead_change');
  });

  it('idempotent: повторно держусь после 50% → не триггерит снова', () => {
    // Once я уже >= 50, переход с 60 → 65 не должен trigger'нуть
    const ms = detectMilestones(sb(60, 30), sb(65, 28), 0);
    expect(ms.find((m) => m.id === 'crossed_50_up')).toBeFalsy();
  });

  it('идемпотент 25_down: уже был < 25 → не trigger', () => {
    const ms = detectMilestones(sb(20, 70), sb(18, 72), 0);
    expect(ms.find((m) => m.id === 'crossed_25_down')).toBeFalsy();
  });

  it('каждый event имеет label + icon + accent', () => {
    const ms = detectMilestones(sb(48, 30), sb(52, 28), 0);
    const event = ms[0]!;
    expect(event.label).toBeTruthy();
    expect(event.icon).toBeTruthy();
    expect(['positive', 'critical', 'comeback']).toContain(event.accent);
  });

  it('один-player scoreboard (no opponent) — нет lead_change', () => {
    const single: ScoreboardSummary = {
      entries: [{ playerIdx: 0, name: 'Me', color: '#F00', cells: 1800, percent: 50, antsAlive: 5 }],
      totalOwned: 1800, totalCells: 3600, neutralCells: 1800,
    };
    const ms = detectMilestones(single, single, 0);
    expect(ms.find((m) => m.id === 'lead_change')).toBeFalsy();
  });
});

describe('milestoneLabel', () => {
  it('возвращает right label per id', () => {
    expect(milestoneLabel('crossed_50_up')).toBe('Taking the lead!');
    expect(milestoneLabel('crossed_75_up')).toBe('Dominating!');
    expect(milestoneLabel('crossed_25_down')).toBe('Critical territory!');
    expect(milestoneLabel('lead_change')).toBe('Comeback!');
  });
});
