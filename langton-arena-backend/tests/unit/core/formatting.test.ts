// tests/unit/core/formatting.test.ts

import { describe, it, expect } from 'vitest';
import { formatTimer, formatPercent, formatLargeNumber, formatSrDelta } from '@langton/core';

describe('formatting', () => {
  it('formatTimer 3000 ticks @ 10 TPS = 5:00', () => {
    expect(formatTimer(3000, 10)).toBe('5:00');
  });
  it('formatPercent 0.453 = 45.3%', () => {
    expect(formatPercent(0.453)).toBe('45.3%');
  });
  it('formatLargeNumber 1234567 = 1.2M', () => {
    expect(formatLargeNumber(1234567)).toBe('1.2M');
  });
  it('formatSrDelta +12 / -8 / ±0', () => {
    expect(formatSrDelta(12)).toBe('+12');
    expect(formatSrDelta(-8)).toBe('-8');
    expect(formatSrDelta(0)).toBe('±0');
  });
});
