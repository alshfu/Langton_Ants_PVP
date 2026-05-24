// tests/unit/core/prng.test.ts

import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@langton/core';

describe('mulberry32', () => {
  it('same seed produces same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('different seeds diverge after first call', () => {
    const a = mulberry32(42);
    const b = mulberry32(43);
    expect(a()).not.toBe(b());
  });

  it.todo('statistically uniform across 100k samples');
});
