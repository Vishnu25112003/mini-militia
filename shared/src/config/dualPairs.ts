import type { WeaponId } from './weapons.js';

/** The 6 allowed dual-wield pairs. Order within a pair doesn't matter. */
export const DUAL_PAIRS: ReadonlyArray<readonly [WeaponId, WeaponId]> = [
  ['TEC9', 'TEC9'],
  ['Uzi', 'Uzi'],
  ['DesertEagle', 'DesertEagle'],
  ['TEC9', 'Uzi'],
  ['DesertEagle', 'TEC9'],
  ['DesertEagle', 'Uzi'],
];

/** True if these two guns can be held as a dual-wield pair, in either order. */
export function isDualPair(a: WeaponId, b: WeaponId): boolean {
  return DUAL_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** True if this gun appears in any dual-wield pair at all (TEC9, Uzi, DesertEagle). */
export function canWeaponDualWield(weapon: WeaponId): boolean {
  return DUAL_PAIRS.some(([a, b]) => a === weapon || b === weapon);
}
