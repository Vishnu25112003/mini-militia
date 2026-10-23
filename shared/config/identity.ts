// Player identity. Source of truth: Game Flow, Section 17 (and Section 2 for room codes).

/** Letters only, 3-12 letters. */
export const NAME_RULE = { min: 3, max: 12, pattern: /^[A-Za-z]+$/ } as const;

export interface PlayerColor {
  id: number;
  name: string;
  hex: string;
}

/** 8 colors, handed out first come, first served. */
export const PLAYER_COLORS: readonly PlayerColor[] = [
  { id: 0, name: 'Red', hex: '#ef4444' },
  { id: 1, name: 'Blue', hex: '#3b82f6' },
  { id: 2, name: 'Green', hex: '#22c55e' },
  { id: 3, name: 'Yellow', hex: '#eab308' },
  { id: 4, name: 'Orange', hex: '#f97316' },
  { id: 5, name: 'Purple', hex: '#a855f7' },
  { id: 6, name: 'Cyan', hex: '#06b6d4' },
  { id: 7, name: 'Pink', hex: '#ec4899' },
];

/**
 * 6 characters, letters + numbers, no confusing characters (0 / O / 1 / I).
 * Letters A-Z without I and O (24) + digits 2-9 (8) = 32 symbols.
 */
export const ROOM_CODE_RULE = {
  length: 6,
  charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;
