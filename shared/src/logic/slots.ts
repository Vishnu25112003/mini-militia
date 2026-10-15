import { isDualPair } from '../config/dualPairs.js';
import type { WeaponId } from '../config/weapons.js';
import type { Slot } from '../types/player.js';

/** Can `newGun` go into a slot that already holds `existingGun` as a dual pair? */
export function canPair(existingGun: WeaponId, newGun: WeaponId): boolean {
  return isDualPair(existingGun, newGun);
}

function weaponsInSlot(slot: Slot): WeaponId[] {
  return slot.kind === 'single' ? [slot.weapon] : [...slot.weapons];
}

/**
 * A loadout is valid when neither slot is empty (guaranteed by the `Slot`
 * type itself) and no gun appears in both slots — the same gun twice is only
 * allowed as a dual pair inside one slot.
 */
export function isValidLoadout(slot1: Slot, slot2: Slot): boolean {
  const inSlot1 = weaponsInSlot(slot1);
  const inSlot2 = weaponsInSlot(slot2);
  return !inSlot1.some((w) => inSlot2.includes(w));
}
