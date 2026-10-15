export const NAME_RULES = {
  minLength: 3,
  maxLength: 12,
  /** Letters only (no digits, spaces, or symbols). */
  pattern: /^[A-Za-z]+$/,
} as const;

/** 8 colors, assigned first-come, first-served as players join. */
export const PLAYER_COLORS = [
  '#e6194b', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#ffe119', // yellow
  '#f58231', // orange
  '#911eb4', // purple
  '#46f0f0', // cyan
  '#f032e6', // pink
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const ROOM_CODE_RULES = {
  length: 6,
  /** Uppercase letters and digits, excluding the confusing 0/O and 1/I. */
  charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;
