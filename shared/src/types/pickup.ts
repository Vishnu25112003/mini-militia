import type { WeaponId } from '../config/weapons.js';
import type { GrenadeId } from '../config/grenades.js';
import type { Vector2 } from './player.js';

export type PickupKind = 'gun' | 'medkit' | 'grenadePair' | 'boostTank';

export interface PickupItem {
  id: string;
  position: Vector2;
  kind: PickupKind;
  /** Set when kind is 'gun'. */
  weapon?: WeaponId;
  /** Set when kind is 'grenadePair'. */
  grenadeType?: GrenadeId;
  spawnedAtMs: number;
}
