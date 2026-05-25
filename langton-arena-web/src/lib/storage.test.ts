// src/lib/storage.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, remove } from './storage';

beforeEach(() => {
  // vitest jsdom: localStorage доступен. Чистим
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('storage', () => {
  it('save and load round-trip', () => {
    const data = { foo: 'bar', n: 42 };
    save('test.key', data);
    expect(load('test.key')).toEqual(data);
  });

  it('load returns null for missing key', () => {
    expect(load('nonexistent')).toBeNull();
  });

  it('remove deletes value', () => {
    save('test.key', { a: 1 });
    remove('test.key');
    expect(load('test.key')).toBeNull();
  });

  it('load returns null for corrupted JSON', () => {
    // напрямую запишем мусор
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('langton.test.corrupt', 'not-json{{{');
    }
    expect(load('test.corrupt')).toBeNull();
  });

  it('handles complex nested objects', () => {
    const complex = {
      players: [{ id: 'p1', ants: [{ x: 10, y: 20 }] }],
      seed: 42,
      flags: { a: true, b: false },
    };
    save('test.complex', complex);
    expect(load('test.complex')).toEqual(complex);
  });

  it('overwrites previous value', () => {
    save('test.key', { v: 1 });
    save('test.key', { v: 2 });
    expect(load<{ v: number }>('test.key')?.v).toBe(2);
  });
});
