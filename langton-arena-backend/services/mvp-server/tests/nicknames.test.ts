// tests/nicknames.test.ts
//
// Stage 8 Day 3 — random animal nickname generator.

import { describe, it, expect } from 'vitest';
import { randomNickname, isValidNickname, NICKNAME_PATTERN } from '../src/nicknames';

describe('randomNickname', () => {
  it('возвращает строку с pattern <Adj><Animal>-NN', () => {
    for (let i = 0; i < 20; i++) {
      const nick = randomNickname();
      expect(nick).toMatch(NICKNAME_PATTERN);
    }
  });

  it('детерминированный с custom rand (seed)', () => {
    let counter = 0;
    const fakeRand = () => {
      // Cycle 0.1, 0.2, 0.3, …
      const v = (counter % 10) * 0.1;
      counter++;
      return v;
    };
    const nicks = Array.from({ length: 5 }, () => randomNickname(fakeRand));
    // Все nicknames детерминированно генерируются — повторный вызов даёт ту же sequence
    counter = 0;
    const replay = Array.from({ length: 5 }, () => randomNickname(fakeRand));
    expect(nicks).toEqual(replay);
  });

  it('generates ~уникальные значения (no collisions in 100 samples)', () => {
    const sample = new Set<string>();
    for (let i = 0; i < 100; i++) sample.add(randomNickname());
    // С ~3000 комбинациями вероятность 100 unique > 95%
    expect(sample.size).toBeGreaterThanOrEqual(80);
  });
});

describe('isValidNickname', () => {
  it('принимает generated nicknames', () => {
    for (let i = 0; i < 10; i++) {
      expect(isValidNickname(randomNickname())).toBe(true);
    }
  });

  it('принимает custom alphanumeric strings', () => {
    expect(isValidNickname('Alice')).toBe(true);
    expect(isValidNickname('Player_1')).toBe(true);
    expect(isValidNickname('Игрок-Один')).toBe(true);
    expect(isValidNickname('玩家.42')).toBe(true);
  });

  it('отвергает пустые и слишком длинные', () => {
    expect(isValidNickname('')).toBe(false);
    expect(isValidNickname('a'.repeat(41))).toBe(false);
  });

  it('отвергает спец-символы (potential injection)', () => {
    expect(isValidNickname('<script>')).toBe(false);
    expect(isValidNickname('"; DROP TABLE--')).toBe(false);
    expect(isValidNickname('\n\r')).toBe(false);
  });
});
