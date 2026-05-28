// src/lib/resumeToken.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { getResumeToken, setResumeToken, clearResumeToken } from './resumeToken';

beforeEach(() => {
  sessionStorage.clear();
});

describe('resumeToken storage', () => {
  it('initially null', () => {
    expect(getResumeToken('room1')).toBeNull();
  });

  it('set + get round-trip', () => {
    setResumeToken('room1', 'abc123');
    expect(getResumeToken('room1')).toBe('abc123');
  });

  it('different rooms isolated', () => {
    setResumeToken('room1', 'token1');
    setResumeToken('room2', 'token2');
    expect(getResumeToken('room1')).toBe('token1');
    expect(getResumeToken('room2')).toBe('token2');
  });

  it('clear удаляет', () => {
    setResumeToken('room1', 'abc');
    clearResumeToken('room1');
    expect(getResumeToken('room1')).toBeNull();
  });

  it('clear не трогает другие rooms', () => {
    setResumeToken('room1', 'a');
    setResumeToken('room2', 'b');
    clearResumeToken('room1');
    expect(getResumeToken('room1')).toBeNull();
    expect(getResumeToken('room2')).toBe('b');
  });

  it('overwrite токена для same room', () => {
    setResumeToken('room1', 'first');
    setResumeToken('room1', 'second');
    expect(getResumeToken('room1')).toBe('second');
  });
});
