import type { WeaponId } from '../config/weapons.js';

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
  defaultLoadout?: readonly [WeaponId, WeaponId];
}
