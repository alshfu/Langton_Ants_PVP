// src/lib/nicknames.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateNickname, getOrCreateNickname, setStoredNickname } from './nicknames';

describe('nicknames', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* */ }
  });

  it('generateNickname matches pattern <Adj><Animal>-NN', () => {
    for (let i = 0; i < 20; i++) {
      const n = generateNickname();
      expect(n).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+-\d{2}$/);
    }
  });

  it('getOrCreateNickname persistant в localStorage', () => {
    const n1 = getOrCreateNickname();
    const n2 = getOrCreateNickname();
    expect(n2).toBe(n1);
  });

  it('setStoredNickname меняет stored', () => {
    setStoredNickname('CustomName');
    expect(getOrCreateNickname()).toBe('CustomName');
  });
});
