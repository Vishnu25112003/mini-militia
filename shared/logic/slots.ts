import { DUAL_GUNS, DUAL_PAIRS } from '../config/dualPairs';
import type { DualGunId, GunId, Slot, SlotSpec } from '../types';

// Gun slots and dual pairs. Source of truth: Game Flow, Section 7 (Gun slots, Dual-wield pairs).

export const isDualCapable = (gun: GunId): gun is DualGunId => (DUAL_GUNS as readonly string[]).includes(gun);

/** True when the two guns form one of the 6 allowed dual pairs (order does not matter). */
export function isValidPair(a: GunId, b: GunId): boolean {
  return DUAL_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Can the gun in a slot be paired with a newly found gun? */
export function canPair(slotGun: GunId, newGun: GunId): boolean {
  return isValidPair(slotGun, newGun);
}

/** The guns inside a slot (one for a single, two for a pair). */
export function slotGuns(slot: Slot | SlotSpec): GunId[] {
  return slot.kind === 'single' ? [slot.gun] : [...slot.guns];
}

export type SlotProblem =
  | 'invalid_pair' // a "pair" that is not one of the 6 allowed pairs
  | 'same_gun_in_both_slots' // the same gun in slot 1 and slot 2
  | 'missing_slot'; // a slot is empty / undefined

/**
 * A loadout is valid when both slots are filled, every pair is one of the 6 allowed pairs, and the same
 * gun never appears in both slots. (The same gun twice is only allowed as a dual pair INSIDE one slot.)
 */
export function validateSlots(slots: readonly [Slot | SlotSpec, Slot | SlotSpec]): SlotProblem[] {
  const problems: SlotProblem[] = [];
  const [a, b] = slots;
  if (!a || !b) return ['missing_slot'];

  for (const s of slots) {
    if (s.kind === 'pair' && !isValidPair(s.guns[0], s.guns[1])) problems.push('invalid_pair');
  }
  const inB = new Set(slotGuns(b));
  if (slotGuns(a).some((g) => inB.has(g))) problems.push('same_gun_in_both_slots');
  return problems;
}

export const isValidLoadout = (slots: readonly [Slot | SlotSpec, Slot | SlotSpec]): boolean =>
  validateSlots(slots).length === 0;
