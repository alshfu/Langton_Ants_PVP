// src/lib/computeHighlights.test.ts

import { describe, it, expect } from 'vitest';
import {
  computeLongestStreak,
  computePeakTerritory,
  computeBiggestFight,
  computeFirstDeath,
  computeMostKillsInClash,
} from './computeHighlights';
import type { LogEvent } from '@core/contract/state';

function makeEvent(
  id: number, tick: number, type: LogEvent['type'],
  x: number, y: number, ownerIdx: number,
): LogEvent {
  return { id, tick, type, x, y, ownerIdx };
}

describe('computeLongestStreak', () => {
  it('returns null when no deaths', () => {
    const events: LogEvent[] = [
      makeEvent(1, 10, 'capture', 5, 5, 0),
      makeEvent(2, 20, 'birth',   3, 3, 1),
    ];
    expect(computeLongestStreak(events, 100)).toBeNull();
  });

  it('returns streak from 0 to first death when only one death', () => {
    const events: LogEvent[] = [
      makeEvent(1, 50, 'death', 5, 5, 0),
    ];
    const h = computeLongestStreak(events, 60);
    expect(h).not.toBeNull();
    // От tick=0 до 50 = 50 ticks, или от 50 до currentTick=60 = 10. 50 больше.
    expect(h!.value).toBe(50);
    expect(h!.tickStart).toBe(0);
    expect(h!.tickEnd).toBe(50);
  });

  it('finds longest gap between deaths', () => {
    const events: LogEvent[] = [
      makeEvent(1, 10, 'death', 1, 1, 0),
      makeEvent(2, 15, 'death', 2, 2, 1),
      makeEvent(3, 200, 'death', 3, 3, 2), // большой gap здесь
      makeEvent(4, 210, 'death', 4, 4, 0),
    ];
    const h = computeLongestStreak(events, 250);
    expect(h!.value).toBe(185); // 200 - 15
    expect(h!.tickStart).toBe(15);
    expect(h!.tickEnd).toBe(200);
  });

  it('considers current streak from last death', () => {
    const events: LogEvent[] = [
      makeEvent(1, 50, 'death', 1, 1, 0),
    ];
    const h = computeLongestStreak(events, 500);
    // От t=50 до t=500 = 450 ticks > 50 (от 0 до 50)
    expect(h!.value).toBe(450);
    expect(h!.tickStart).toBe(50);
    expect(h!.tickEnd).toBe(500);
  });
});

describe('computePeakTerritory', () => {
  it('returns null when history empty', () => {
    expect(computePeakTerritory([], [{ id: 'p0', name: 'P1' }])).toBeNull();
  });

  it('finds player with highest territory %', () => {
    const history = [
      { tick: 10, byPlayer: { p0: 0.2, p1: 0.3 } },
      { tick: 20, byPlayer: { p0: 0.45, p1: 0.5 } },
      { tick: 30, byPlayer: { p0: 0.7,  p1: 0.2 } }, // peak P1
      { tick: 40, byPlayer: { p0: 0.6,  p1: 0.3 } },
    ];
    const players = [{ id: 'p0', name: 'Alpha' }, { id: 'p1', name: 'Beta' }];
    const h = computePeakTerritory(history, players);
    expect(h!.value).toBeCloseTo(0.7);
    expect(h!.tickStart).toBe(30);
    expect(h!.description).toContain('Alpha');
    expect(h!.description).toContain('70.0%');
  });
});

describe('computeBiggestFight', () => {
  it('returns null when no contested data', () => {
    const heatmap = {
      w: 10, h: 10,
      contested: new Uint32Array(100),
      maxContested: 0,
    };
    expect(computeBiggestFight(heatmap)).toBeNull();
  });

  it('finds first cell with max contested value', () => {
    const heatmap = {
      w: 5, h: 5,
      contested: new Uint32Array(25),
      maxContested: 7,
    };
    // Кладём max в (2, 1) — индекс 7
    heatmap.contested[7] = 7; // y=1, x=2 → 1*5+2=7
    heatmap.contested[12] = 3; // меньше

    const h = computeBiggestFight(heatmap);
    expect(h!.value).toBe(7);
    expect(h!.x).toBe(2);
    expect(h!.y).toBe(1);
    expect(h!.description).toContain('(2, 1)');
    expect(h!.description).toContain('7 clashes');
  });
});

describe('computeFirstDeath', () => {
  it('returns null when no deaths', () => {
    const events: LogEvent[] = [
      makeEvent(1, 5, 'capture', 0, 0, 0),
    ];
    expect(computeFirstDeath(null, events, [])).toBeNull();
  });

  it('uses cached firstDeath when provided', () => {
    const cached = makeEvent(99, 42, 'death', 5, 5, 1);
    const players = [{ id: 'p0', name: 'A' }, { id: 'p1', name: 'B' }];
    const h = computeFirstDeath(cached, [], players);
    expect(h!.value).toBe(42);
    expect(h!.tickStart).toBe(42);
    expect(h!.description).toContain('B');
    expect(h!.description).toContain('t42');
  });

  it('scans events when no cache', () => {
    const events: LogEvent[] = [
      makeEvent(1, 10, 'capture', 0, 0, 0),
      makeEvent(2, 25, 'death', 3, 3, 0),
      makeEvent(3, 30, 'death', 4, 4, 1),
    ];
    const h = computeFirstDeath(null, events, [{ id: 'p0', name: 'Alpha' }]);
    expect(h!.value).toBe(25);
    expect(h!.description).toContain('Alpha');
  });
});

describe('computeMostKillsInClash', () => {
  it('returns null when no deaths', () => {
    expect(computeMostKillsInClash([])).toBeNull();
  });

  it('returns null when no clash has 2+ deaths', () => {
    const events: LogEvent[] = [
      makeEvent(1, 10, 'death', 5, 5, 0),
      makeEvent(2, 20, 'death', 5, 5, 1), // разный tick — не один clash
    ];
    expect(computeMostKillsInClash(events)).toBeNull();
  });

  it('finds clash with most deaths (same tick + cell)', () => {
    const events: LogEvent[] = [
      makeEvent(1, 10, 'death', 5, 5, 0),
      makeEvent(2, 10, 'death', 5, 5, 1),
      makeEvent(3, 10, 'death', 5, 5, 2),
      makeEvent(4, 20, 'death', 8, 8, 0), // меньший
      makeEvent(5, 20, 'death', 8, 8, 1),
    ];
    const h = computeMostKillsInClash(events);
    expect(h!.value).toBe(3);
    expect(h!.tickStart).toBe(10);
    expect(h!.x).toBe(5);
    expect(h!.y).toBe(5);
  });

  it('takes maximum across multiple clashes', () => {
    const events: LogEvent[] = [
      makeEvent(1, 10, 'death', 5, 5, 0),
      makeEvent(2, 10, 'death', 5, 5, 1),
      makeEvent(3, 50, 'death', 9, 9, 0),
      makeEvent(4, 50, 'death', 9, 9, 1),
      makeEvent(5, 50, 'death', 9, 9, 2),
      makeEvent(6, 50, 'death', 9, 9, 3),
    ];
    const h = computeMostKillsInClash(events);
    expect(h!.value).toBe(4);
    expect(h!.tickStart).toBe(50);
  });
});
