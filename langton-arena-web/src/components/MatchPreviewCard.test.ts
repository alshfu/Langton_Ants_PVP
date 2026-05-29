// src/components/MatchPreviewCard.test.ts
//
// Smoke tests для match preview data + default snapshot.

import { describe, it, expect } from 'vitest';
import { STAGE8_DEFAULT_PREVIEW } from './MatchPreviewCard';

describe('STAGE8_DEFAULT_PREVIEW', () => {
  it('соответствует server defaultMatchConfig dimensions', () => {
    expect(STAGE8_DEFAULT_PREVIEW.width).toBe(60);
    expect(STAGE8_DEFAULT_PREVIEW.height).toBe(60);
  });

  it('topology torus (как на server)', () => {
    expect(STAGE8_DEFAULT_PREVIEW.topology).toBe('torus');
  });

  it('30 seconds = 300 ticks / 10 TPS', () => {
    expect(STAGE8_DEFAULT_PREVIEW.durationSeconds).toBe(30);
  });

  it('antsPerPlayer = 3 (match config Stage 8)', () => {
    expect(STAGE8_DEFAULT_PREVIEW.antsPerPlayer).toBe(3);
  });

  it('maxPlayers = 2 (PvP MVP)', () => {
    expect(STAGE8_DEFAULT_PREVIEW.maxPlayers).toBe(2);
  });

  it('mutations enabled (halo по умолчанию)', () => {
    expect(STAGE8_DEFAULT_PREVIEW.mutationsEnabled).toBe(true);
  });

  it('win condition = most territory', () => {
    expect(STAGE8_DEFAULT_PREVIEW.winLabel).toBe('Most territory');
  });

  it('rule = Classic', () => {
    expect(STAGE8_DEFAULT_PREVIEW.ruleLabel).toContain('Classic');
  });
});
