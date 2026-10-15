import { describe, expect, it } from 'vitest';
import { ROOM_CODE_RULES } from '../config/identity.js';
import { generateRoomCode, validateName } from './validation.js';

describe('validateName', () => {
  it('accepts letters-only names between 3 and 12 characters', () => {
    expect(validateName('Bob')).toBe(true);
    expect(validateName('Abcdefghijkl')).toBe(true);
  });

  it('rejects names that are too short, too long, or not letters-only', () => {
    expect(validateName('Al')).toBe(false); // too short
    expect(validateName('Abcdefghijklm')).toBe(false); // too long (13)
    expect(validateName('Bob1')).toBe(false); // digit
    expect(validateName('Bob Smith')).toBe(false); // space
    expect(validateName('')).toBe(false);
  });
});

describe('generateRoomCode', () => {
  it('is 6 characters long, using only the non-confusing charset', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_RULES.length);
    for (const char of code) {
      expect(ROOM_CODE_RULES.charset).toContain(char);
    }
  });

  it('never contains the excluded 0, O, 1, I characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('is deterministic given an injected random function', () => {
    const fixedRandom = () => 0;
    const code = generateRoomCode(fixedRandom);
    expect(code).toBe(ROOM_CODE_RULES.charset[0]!.repeat(ROOM_CODE_RULES.length));
  });
});
