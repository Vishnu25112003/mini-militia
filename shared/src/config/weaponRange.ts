import type { WeaponRange } from './weapons.js';

/**
 * The flow only names ranges categorically (Short … Very long) — these pixel
 * distances are this build's first pass at turning that into a real hitscan
 * cutoff, sized against the Catacombs map (100×60 tiles @ 32px ≈ 3200×1920,
 * diagonal ≈ 3732px). Tune during playtesting (Phase 16), per the doc.
 */
export const WEAPON_RANGE_PX: Record<WeaponRange, number> = {
  'very-short': 160,
  short: 560,
  'short-medium': 760,
  medium: 1100,
  'medium-long': 1450,
  long: 1900,
  'very-long': 2800,
};
