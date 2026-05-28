// tests/roomManager.test.ts
//
// Stage 8 Day 3 — RoomManager unit tests.

import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../src/roomManager';

describe('RoomManager', () => {
  let rooms: RoomManager;

  beforeEach(() => { rooms = new RoomManager(); });

  it('initial state: empty', () => {
    expect(rooms.size).toBe(0);
    expect(rooms.all).toEqual([]);
    expect(rooms.get('any')).toBeUndefined();
  });

  it('getOrCreate — creates new если нет, returns existing если есть', () => {
    const r1 = rooms.getOrCreate('a');
    const r2 = rooms.getOrCreate('a');
    expect(r1).toBe(r2); // same instance
    expect(rooms.size).toBe(1);

    const r3 = rooms.getOrCreate('b');
    expect(r3).not.toBe(r1);
    expect(rooms.size).toBe(2);
  });

  it('get — null для несуществующего code', () => {
    rooms.getOrCreate('a');
    expect(rooms.get('a')).toBeDefined();
    expect(rooms.get('b')).toBeUndefined();
  });

  it('delete — убирает room', () => {
    rooms.getOrCreate('a');
    expect(rooms.delete('a')).toBe(true);
    expect(rooms.size).toBe(0);
    expect(rooms.delete('a')).toBe(false); // уже нет
  });

  it('clear — обнуляет всё', () => {
    rooms.getOrCreate('a');
    rooms.getOrCreate('b');
    rooms.getOrCreate('c');
    rooms.clear();
    expect(rooms.size).toBe(0);
  });

  it('all — список ReadonlyArray<Room>', () => {
    rooms.getOrCreate('a');
    rooms.getOrCreate('b');
    expect(rooms.all.length).toBe(2);
    expect(rooms.all.map((r) => r.code).sort()).toEqual(['a', 'b']);
  });
});
