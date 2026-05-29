// src/lib/onboarding.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { hasSeenHint, markHintSeen, resetAllHints } from './onboarding';

describe('onboarding hints', () => {
  beforeEach(() => {
    resetAllHints();
  });

  it('fresh storage → no hints seen', () => {
    expect(hasSeenHint('match_lobby')).toBe(false);
    expect(hasSeenHint('match_playing')).toBe(false);
    expect(hasSeenHint('match_finished')).toBe(false);
  });

  it('markHintSeen persists across calls', () => {
    markHintSeen('match_lobby');
    expect(hasSeenHint('match_lobby')).toBe(true);
    // Другие не затронуты
    expect(hasSeenHint('match_playing')).toBe(false);
  });

  it('markHintSeen идемпотентен — повторный вызов no-op', () => {
    markHintSeen('match_lobby');
    markHintSeen('match_lobby');
    markHintSeen('match_lobby');
    expect(hasSeenHint('match_lobby')).toBe(true);
  });

  it('marking один hint не задевает другие', () => {
    markHintSeen('match_playing');
    expect(hasSeenHint('match_playing')).toBe(true);
    expect(hasSeenHint('match_lobby')).toBe(false);
    expect(hasSeenHint('match_finished')).toBe(false);
  });

  it('resetAllHints стирает все', () => {
    markHintSeen('match_lobby');
    markHintSeen('match_playing');
    markHintSeen('match_finished');
    resetAllHints();
    expect(hasSeenHint('match_lobby')).toBe(false);
    expect(hasSeenHint('match_playing')).toBe(false);
    expect(hasSeenHint('match_finished')).toBe(false);
  });

  it('state выживает across hot reloads (через localStorage)', () => {
    markHintSeen('match_lobby');
    // Simulate "module reload" — readSeen парсит из storage заново
    expect(hasSeenHint('match_lobby')).toBe(true);
  });

  it('handles corrupted localStorage gracefully', () => {
    // Запись невалидного JSON
    window.localStorage.setItem('langton.onboarding.seen', '{not-valid-json');
    expect(hasSeenHint('match_lobby')).toBe(false);
    // markHintSeen после corruption — должен перезаписать чистым state
    markHintSeen('match_lobby');
    expect(hasSeenHint('match_lobby')).toBe(true);
  });

  it('handles non-array JSON gracefully', () => {
    window.localStorage.setItem('langton.onboarding.seen', '{"foo": "bar"}');
    expect(hasSeenHint('match_lobby')).toBe(false);
  });

  it('handles array with non-string entries', () => {
    window.localStorage.setItem('langton.onboarding.seen', '[123, null, "match_lobby"]');
    // Только string entries должны учитываться
    expect(hasSeenHint('match_lobby')).toBe(true);
  });
});
