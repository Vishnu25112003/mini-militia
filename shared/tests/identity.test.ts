import { describe, expect, it } from 'vitest';
import { PLAYER_COLORS, ROOM_CODE_RULE } from '../config/identity';
import {
  firstFreeColor,
  generateRoomCode,
  isValidRoomCode,
  nameErrorMessage,
  normalizeRoomCode,
  sameName,
  validateName,
} from '../logic/identity';
import { mulberry32 } from './helpers';

describe('names (Game Flow, Section 17)', () => {
  it('accepts letters only, 3 to 12 letters', () => {
    for (const ok of ['Dev', 'Alex', 'Zoe', 'abcdefghijkl', 'ABCDEFGHIJKL', 'MiXeDcAsE']) {
      expect(validateName(ok), ok).toEqual({ ok: true });
    }
  });

  it('rejects too short, too long, empty', () => {
    expect(validateName('Ab')).toEqual({ ok: false, reason: 'too_short' });
    expect(validateName('A')).toEqual({ ok: false, reason: 'too_short' });
    expect(validateName('abcdefghijklm')).toEqual({ ok: false, reason: 'too_long' }); // 13
    expect(validateName('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects anything that is not a plain letter', () => {
    for (const bad of [
      'Dev4',
      'Dev Name',
      'Dev_x',
      'Dev-x',
      ' Dev',
      'Dev ',
      'Ünal',
      '名前名前',
      '123',
      'a.b',
      'Dev!',
    ]) {
      expect(validateName(bad), bad).toEqual({ ok: false, reason: 'invalid_characters' });
    }
  });

  it('has a friendly message for every problem', () => {
    for (const reason of ['empty', 'too_short', 'too_long', 'invalid_characters'] as const) {
      expect(nameErrorMessage(reason).length).toBeGreaterThan(5);
    }
  });

  it('names are compared ignoring case (first come, first served)', () => {
    expect(sameName('Dev', 'dEV')).toBe(true);
    expect(sameName('Dev', 'Dave')).toBe(false);
  });
});

describe('room codes (Game Flow, Section 2)', () => {
  it('uses 6 characters from a set without 0, O, 1, I', () => {
    expect(ROOM_CODE_RULE.length).toBe(6);
    expect(ROOM_CODE_RULE.charset).toHaveLength(32);
    for (const banned of ['0', 'O', '1', 'I']) expect(ROOM_CODE_RULE.charset).not.toContain(banned);
    expect(new Set(ROOM_CODE_RULE.charset).size).toBe(32); // no duplicates
  });

  it('every generated code is 6 valid characters', () => {
    const rnd = mulberry32(2024);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = generateRoomCode(rnd);
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(isValidRoomCode(code)).toBe(true);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(1990); // essentially no collisions
  });

  it('edge values of the random source never index out of range', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAAA');
    expect(generateRoomCode(() => 0.999999999)).toBe('999999');
  });

  it('default random source works', () => {
    expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });

  it('validates and normalises codes typed or pasted by players', () => {
    expect(isValidRoomCode('K7P2QX')).toBe(true);
    expect(isValidRoomCode('K7P2QO')).toBe(false); // O
    expect(isValidRoomCode('K7P2Q1')).toBe(false); // 1
    expect(isValidRoomCode('K7P2Q')).toBe(false); // too short
    expect(isValidRoomCode('K7P2QXX')).toBe(false); // too long
    expect(normalizeRoomCode('  k7p2qx\n')).toBe('K7P2QX');
  });
});

describe('colors (Game Flow, Section 17)', () => {
  it('there are 8 distinct colors', () => {
    expect(PLAYER_COLORS).toHaveLength(8);
    expect(new Set(PLAYER_COLORS.map((c) => c.hex)).size).toBe(8);
    expect(PLAYER_COLORS.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('hands out the first free color, then null when all 8 are taken', () => {
    expect(firstFreeColor([])).toBe(0);
    expect(firstFreeColor([0, 1, 3])).toBe(2);
    expect(firstFreeColor([0, 1, 2, 3, 4, 5, 6])).toBe(7);
    expect(firstFreeColor([0, 1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });
});
