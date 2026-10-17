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
  /** Set when kind is 'grenadePair' — starts at 2, can drop to 1 after a partial pickup (carry limit). */
  grenadeCount?: 1 | 2;
  spawnedAtMs: number;
}
