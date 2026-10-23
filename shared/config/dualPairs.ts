import type { DualGunId } from '../types';

// Dual-wield pairs. Source of truth: Game Flow, Section 7 "Dual-wield pairs (6)".
// Only TEC9, Uzi and Desert Eagle can be dual-wielded.

export const DUAL_GUNS: readonly DualGunId[] = ['tec9', 'uzi', 'desert_eagle'];

/** Exactly the six allowed pairs (order does not matter). */
export const DUAL_PAIRS: readonly (readonly [DualGunId, DualGunId])[] = [
  ['tec9', 'tec9'],
  ['uzi', 'uzi'],
  ['desert_eagle', 'desert_eagle'],
  ['tec9', 'uzi'],
  ['desert_eagle', 'tec9'],
  ['desert_eagle', 'uzi'],
];
