// src/lib/roomCodes.test.ts

import { describe, it, expect } from 'vitest';
import { generateRoomCode, buildMatchUrl, isValidRoomCodeChar } from './roomCodes';

describe('generateRoomCode', () => {
  it('default length 6', () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it('custom length', () => {
    expect(generateRoomCode(8)).toHaveLength(8);
    expect(generateRoomCode(4)).toHaveLength(4);
    expect(generateRoomCode(12)).toHaveLength(12);
  });

  it('каждый char из valid alphabet', () => {
    const code = generateRoomCode(100);
    for (const ch of code) {
      expect(isValidRoomCodeChar(ch)).toBe(true);
    }
  });

  it('не содержит ambiguous chars (I, l, O, 0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[IlO01]/);
    }
  });

  it('содержит достаточно entropy — 2 calls give different codes (statistically)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateRoomCode());
    // 31^6 = 887M possibilities, 100 calls должны быть unique с overwhelming probability
    expect(codes.size).toBe(100);
  });
});

describe('buildMatchUrl', () => {
  it('без bot param: /?room=XXX', () => {
    expect(buildMatchUrl('ABCDEF')).toBe('/?room=ABCDEF');
  });

  it('с bot=easy: /?room=XXX&bot=easy', () => {
    expect(buildMatchUrl('ABCDEF', 'easy')).toBe('/?room=ABCDEF&bot=easy');
  });

  it('с bot=hard', () => {
    expect(buildMatchUrl('XYZ123', 'hard')).toBe('/?room=XYZ123&bot=hard');
  });

  it('encodes special chars в room code', () => {
    expect(buildMatchUrl('A B&C')).toContain('A%20B%26C');
  });
});

describe('isValidRoomCodeChar', () => {
  it('valid chars true', () => {
    expect(isValidRoomCodeChar('A')).toBe(true);
    expect(isValidRoomCodeChar('Z')).toBe(true);
    expect(isValidRoomCodeChar('2')).toBe(true);
    expect(isValidRoomCodeChar('9')).toBe(true);
  });

  it('ambiguous chars false', () => {
    expect(isValidRoomCodeChar('I')).toBe(false);
    expect(isValidRoomCodeChar('l')).toBe(false);
    expect(isValidRoomCodeChar('O')).toBe(false);
    expect(isValidRoomCodeChar('0')).toBe(false);
    expect(isValidRoomCodeChar('1')).toBe(false);
  });

  it('lowercase normalizes до uppercase для check', () => {
    expect(isValidRoomCodeChar('a')).toBe(true);
    expect(isValidRoomCodeChar('z')).toBe(true);
  });

  it('non-alphanumeric false', () => {
    expect(isValidRoomCodeChar('@')).toBe(false);
    expect(isValidRoomCodeChar(' ')).toBe(false);
    expect(isValidRoomCodeChar('-')).toBe(false);
  });
});
