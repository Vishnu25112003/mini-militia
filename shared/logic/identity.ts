import { NAME_RULE, PLAYER_COLORS, ROOM_CODE_RULE } from '../config/identity';

// Names, colors and room codes. Source of truth: Game Flow, Sections 2 and 17.

export type NameProblem = 'empty' | 'too_short' | 'too_long' | 'invalid_characters';

export type NameCheck = { ok: true } | { ok: false; reason: NameProblem };

/** Letters only, 3-12 letters. */
export function validateName(name: string): NameCheck {
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if (!NAME_RULE.pattern.test(name)) return { ok: false, reason: 'invalid_characters' };
  if (name.length < NAME_RULE.min) return { ok: false, reason: 'too_short' };
  if (name.length > NAME_RULE.max) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

/** Human-readable message for the name screen. */
export function nameErrorMessage(reason: NameProblem): string {
  switch (reason) {
    case 'empty':
      return 'Please enter a name.';
    case 'too_short':
      return `Name needs at least ${NAME_RULE.min} letters.`;
    case 'too_long':
      return `Name can have at most ${NAME_RULE.max} letters.`;
    case 'invalid_characters':
      return 'Use letters only (A-Z), no spaces, numbers or symbols.';
  }
}

/** Names are compared ignoring case (first come, first served). */
export const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** 6 characters from the no-confusing-characters set. Pass your own random source for tests. */
export function generateRoomCode(random: () => number = Math.random): string {
  const { length, charset } = ROOM_CODE_RULE;
  let code = '';
  for (let i = 0; i < length; i++) code += charset[Math.floor(random() * charset.length) % charset.length];
  return code;
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_RULE.length && [...code].every((c) => ROOM_CODE_RULE.charset.includes(c));
}

/** Normalise what a player typed or pasted (trim, upper-case). */
export const normalizeRoomCode = (raw: string): string => raw.trim().toUpperCase();

/** First of the 8 colors not already taken, or null when all are taken. */
export function firstFreeColor(taken: Iterable<number>): number | null {
  const used = new Set(taken);
  const free = PLAYER_COLORS.find((c) => !used.has(c.id));
  return free ? free.id : null;
}
