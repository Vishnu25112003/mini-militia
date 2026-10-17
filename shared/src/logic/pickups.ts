import { canWeaponDualWield, isDualPair } from '../config/dualPairs.js';
import { WEAPONS, type WeaponId } from '../config/weapons.js';
import { MATCH_RULES } from '../config/matchRules.js';
import type { GrenadeId } from '../config/grenades.js';
import type { DualSlot, GrenadeInventory, PlayerState, SingleSlot, Slot } from '../types/player.js';

/**
 * What tapping Pickup/Pair on a ground gun would do, given the player's
 * ACTIVE slot only — the flow calls it "the currently held gun". The other
 * slot is never touched by a gun pickup.
 */
export type GunPickupAction =
  | { kind: 'pair' }
  | { kind: 'replace' }
  /** The active slot already holds a dual pair, and the ground gun could re-pair with EITHER of
   *  the two — the flow has the player choose which one to swap out. */
  | { kind: 'chooseReplace' }
  | { kind: 'none' };

function activeSlotWeapons(slot: Slot): WeaponId[] {
  return slot.kind === 'single' ? [slot.weapon] : [...slot.weapons];
}

/** The Pickup/Pair button logic table from the flow, decided from the active slot alone. */
export function decideGunPickup(activeSlot: Slot, groundWeapon: WeaponId): GunPickupAction {
  if (activeSlot.kind === 'single') {
    if (activeSlot.weapon === groundWeapon) {
      // "Already own that gun" — a Pair button only if it's dual-capable, otherwise nothing.
      return canWeaponDualWield(groundWeapon) ? { kind: 'pair' } : { kind: 'none' };
    }
    return isDualPair(activeSlot.weapon, groundWeapon) ? { kind: 'pair' } : { kind: 'replace' };
  }

  // Active slot already holds a dual pair.
  if (canWeaponDualWield(groundWeapon)) return { kind: 'chooseReplace' };
  return { kind: 'replace' }; // breaking the pair — both current guns drop
}

function freshSlotFor(weapon: WeaponId): SingleSlot {
  const stats = WEAPONS[weapon];
  return {
    kind: 'single',
    weapon,
    ammoInMagazine: stats.magazine,
    ammoReserve: stats.reserve ?? 0,
    cooldownRemainingSeconds: 0,
    reloadRemainingSeconds: 0,
  };
}

function freshDualSlotFor(weapons: readonly [WeaponId, WeaponId]): DualSlot {
  const [a, b] = weapons;
  const statsA = WEAPONS[a];
  const statsB = WEAPONS[b];
  return {
    kind: 'dual',
    weapons,
    ammoInMagazine: [statsA.magazine, statsB.magazine],
    ammoReserve: [statsA.reserve ?? 0, statsB.reserve ?? 0],
    cooldownRemainingSeconds: 0,
    reloadRemainingSeconds: 0,
  };
}

export interface GunPickupResult {
  state: PlayerState;
  /** Gun(s) that land on the ground as a result — a dropped single gun, or both halves of a broken pair. */
  dropped: WeaponId[];
}

/**
 * Applies a gun pickup to the player's active slot. `replaceSlotChoice` only
 * matters for a `'chooseReplace'` decision (which of the dual pair's two guns
 * to swap out) — any value is ignored for every other decision kind.
 * Picked-up guns always come with full ammo (Dev4-confirmed); a kept gun in a
 * pair retains whatever ammo it already had.
 */
export function applyGunPickup(
  state: PlayerState,
  groundWeapon: WeaponId,
  replaceSlotChoice: 0 | 1 = 0,
): GunPickupResult {
  const activeSlot = state.slots[state.activeSlotIndex];
  const action = decideGunPickup(activeSlot, groundWeapon);
  const slots = [...state.slots] as [Slot, Slot];

  switch (action.kind) {
    case 'none':
      return { state, dropped: [] };

    case 'pair': {
      if (activeSlot.kind === 'single') {
        // The ground gun pairs with the single gun already held — keep its ammo, give the new one full ammo.
        const existing = activeSlot;
        const pairWeapons: readonly [WeaponId, WeaponId] = [existing.weapon, groundWeapon];
        const fresh = freshDualSlotFor(pairWeapons);
        slots[state.activeSlotIndex] = {
          ...fresh,
          ammoInMagazine: [existing.ammoInMagazine, fresh.ammoInMagazine[1]],
          ammoReserve: [existing.ammoReserve, fresh.ammoReserve[1]],
        };
        return { state: { ...state, slots }, dropped: [] };
      }
      return { state, dropped: [] }; // decideGunPickup never returns 'pair' for an already-dual slot
    }

    case 'replace': {
      const dropped = activeSlotWeapons(activeSlot);
      slots[state.activeSlotIndex] = freshSlotFor(groundWeapon);
      return { state: { ...state, slots }, dropped };
    }

    case 'chooseReplace': {
      if (activeSlot.kind !== 'dual') return { state, dropped: [] }; // decideGunPickup guarantees dual here
      const kept = activeSlot.weapons[replaceSlotChoice === 0 ? 1 : 0];
      const keptAmmoInMagazine = activeSlot.ammoInMagazine[replaceSlotChoice === 0 ? 1 : 0];
      const keptAmmoReserve = activeSlot.ammoReserve[replaceSlotChoice === 0 ? 1 : 0];
      const dropped = [activeSlot.weapons[replaceSlotChoice]];

      const newPairWeapons: readonly [WeaponId, WeaponId] =
        replaceSlotChoice === 0 ? [groundWeapon, kept] : [kept, groundWeapon];
      const fresh = freshDualSlotFor(newPairWeapons);
      const ammoInMagazine: readonly [number, number] =
        replaceSlotChoice === 0 ? [fresh.ammoInMagazine[0], keptAmmoInMagazine] : [keptAmmoInMagazine, fresh.ammoInMagazine[1]];
      const ammoReserve: readonly [number, number] =
        replaceSlotChoice === 0 ? [fresh.ammoReserve[0], keptAmmoReserve] : [keptAmmoReserve, fresh.ammoReserve[1]];

      slots[state.activeSlotIndex] = { ...fresh, ammoInMagazine, ammoReserve };
      return { state: { ...state, slots }, dropped };
    }
  }
}

export interface GrenadePickupResult {
  grenades: GrenadeInventory;
  /** How many the player actually took. */
  taken: number;
}

/**
 * Max 5 grenades total, any mix — at 4, a pair (`available = 2`) takes 1 and
 * leaves 1; at 5, takes 0 (stays on the map). `available` defaults to 2 (a
 * map pickup pair); a death-scattered pile can pass a different count.
 */
export function pickUpGrenadePair(
  grenades: GrenadeInventory,
  type: GrenadeId,
  available = 2,
): GrenadePickupResult {
  const total = grenades.Fragnade + grenades.Gasnade + grenades.Proxynade;
  const room = Math.max(0, MATCH_RULES.grenadeCarryLimit - total);
  const taken = Math.min(available, room);
  if (taken === 0) return { grenades, taken };

  return { grenades: { ...grenades, [type]: grenades[type] + taken }, taken };
}

/** Full heal to 100 — a no-op (not consumed) at full health, per Dev4. */
export function applyMedkit(state: PlayerState): PlayerState | null {
  if (state.health >= MATCH_RULES.maxHealth) return null;
  return { ...state, health: MATCH_RULES.maxHealth };
}

/** Full boost refill — a no-op (not consumed) at full fuel, symmetric with the medkit rule. */
export function applyBoostTank(state: PlayerState, fuelCapacity: number): PlayerState | null {
  if (state.fuel >= fuelCapacity) return null;
  return { ...state, fuel: fuelCapacity };
}
