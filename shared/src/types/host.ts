import type { WeaponId } from '../config/weapons.js';

/** One of the default loadout's two slots — a single gun, or a dual pair (see config/dualPairs.ts). */
export type LoadoutSlotSelection =
  | { kind: 'single'; weapon: WeaponId }
  | { kind: 'dual'; weapons: readonly [WeaponId, WeaponId] };

export interface HostSettings {
  playerCount: number;
  gameTimeSeconds: number;
  mapDropsCountdownSeconds: number;
  /** 0-100; see config/movement.ts gravityForSetting. */
  gravity: number;
  /** 0-100; see config/movement.ts fuelDrainRateForSetting. */
  boost: number;
  defaultLoadoutEnabled: boolean;
  /** Required when defaultLoadoutEnabled is true. */
  defaultLoadout?: readonly [LoadoutSlotSelection, LoadoutSlotSelection];
}
