export type WeaponId =
  | 'AK47'
  | 'M16'
  | 'Tavor'
  | 'XM8'
  | 'M14'
  | 'M93BA'
  | 'Uzi'
  | 'MP5'
  | 'TEC9'
  | 'DesertEagle'
  | 'Shotgun'
  | 'SMAW'
  | 'RG6'
  | 'Flame'
  | 'Phasr';

export type WeaponGroup =
  'assault' | 'marksman' | 'smg-pistol' | 'shotgun' | 'launcher' | 'special';

export type WeaponRange =
  'very-short' | 'short' | 'short-medium' | 'medium' | 'medium-long' | 'long' | 'very-long';

export type WeaponBehaviour =
  'hitscan' | 'burst' | 'shotgun-pellets' | 'rocket' | 'grenade-launcher' | 'flame' | 'laser';

/**
 * All fields are the gun's base stats from the flow. Fields only a few guns
 * use (burst, pellets, splash, fuel) stay optional rather than forcing every
 * gun into one mechanic's shape.
 */
export interface WeaponStats {
  id: WeaponId;
  name: string;
  group: WeaponGroup;
  behaviour: WeaponBehaviour;
  /** Damage per hit (per pellet for Shotgun, per tick for Flame). */
  damage: number;
  /** Damage to a crouching player hit on the front side. */
  crouchDamage: number;
  /** Shots per second (ticks per second for Flame). */
  fireRate: number;
  magazine: number;
  /** Null when the gun has no reserve ammo pool (Flame). */
  reserve: number | null;
  /** Seconds to reload; null when the gun has no reload (Flame). */
  reload: number | null;
  range: WeaponRange;
  /** Zoom magnification factor. */
  zoom: number;
  /** Shots per burst, for burst-fire guns (M16). */
  burstSize?: number;
  /** Pellets per shot, for the Shotgun. */
  pelletCount?: number;
  /** SMAW-style direct-hit damage, separate from splash damage. */
  directHitDamage?: number;
  crouchDirectHitDamage?: number;
  /** Splash damage for explosive launchers (SMAW, RG6). */
  splashDamage?: number;
  crouchSplashDamage?: number;
  /** Fuel capacity in place of magazine, for the Flame. */
  fuelCapacity?: number;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  AK47: {
    id: 'AK47',
    name: 'AK47',
    group: 'assault',
    behaviour: 'hitscan',
    damage: 14,
    crouchDamage: 5,
    fireRate: 8,
    magazine: 30,
    reserve: 90,
    reload: 2.0,
    range: 'medium',
    zoom: 1.4,
  },
  M16: {
    id: 'M16',
    name: 'M16',
    group: 'assault',
    behaviour: 'burst',
    damage: 12,
    crouchDamage: 4,
    fireRate: 9,
    burstSize: 3,
    magazine: 30,
    reserve: 90,
    reload: 1.8,
    range: 'medium',
    zoom: 1.4,
  },
  Tavor: {
    id: 'Tavor',
    name: 'Tavor',
    group: 'assault',
    behaviour: 'hitscan',
    damage: 11,
    crouchDamage: 4,
    fireRate: 10,
    magazine: 30,
    reserve: 90,
    reload: 1.8,
    range: 'medium',
    zoom: 1.2,
  },
  XM8: {
    id: 'XM8',
    name: 'XM8',
    group: 'assault',
    behaviour: 'hitscan',
    damage: 13,
    crouchDamage: 4,
    fireRate: 8,
    magazine: 30,
    reserve: 90,
    reload: 1.8,
    range: 'medium-long',
    zoom: 1.6,
  },
  M14: {
    id: 'M14',
    name: 'M14',
    group: 'marksman',
    behaviour: 'hitscan',
    damage: 30,
    crouchDamage: 10,
    fireRate: 3,
    magazine: 15,
    reserve: 45,
    reload: 2.2,
    range: 'long',
    zoom: 2,
  },
  M93BA: {
    id: 'M93BA',
    name: 'M93BA',
    group: 'marksman',
    behaviour: 'hitscan',
    damage: 95,
    crouchDamage: 30,
    fireRate: 0.8,
    magazine: 5,
    reserve: 15,
    reload: 3.0,
    range: 'very-long',
    zoom: 3,
  },
  Uzi: {
    id: 'Uzi',
    name: 'Uzi',
    group: 'smg-pistol',
    behaviour: 'hitscan',
    damage: 7,
    crouchDamage: 2,
    fireRate: 14,
    magazine: 30,
    reserve: 90,
    reload: 1.5,
    range: 'short',
    zoom: 1,
  },
  MP5: {
    id: 'MP5',
    name: 'MP5',
    group: 'smg-pistol',
    behaviour: 'hitscan',
    damage: 8,
    crouchDamage: 3,
    fireRate: 12,
    magazine: 30,
    reserve: 90,
    reload: 1.6,
    range: 'short-medium',
    zoom: 1.2,
  },
  TEC9: {
    id: 'TEC9',
    name: 'TEC9',
    group: 'smg-pistol',
    behaviour: 'hitscan',
    damage: 7,
    crouchDamage: 2,
    fireRate: 12,
    magazine: 20,
    reserve: 80,
    reload: 1.4,
    range: 'short',
    zoom: 1,
  },
  DesertEagle: {
    id: 'DesertEagle',
    name: 'Desert Eagle',
    group: 'smg-pistol',
    behaviour: 'hitscan',
    damage: 28,
    crouchDamage: 9,
    fireRate: 3,
    magazine: 7,
    reserve: 28,
    reload: 1.6,
    range: 'medium',
    zoom: 1.2,
  },
  Shotgun: {
    id: 'Shotgun',
    name: 'Shotgun',
    group: 'shotgun',
    behaviour: 'shotgun-pellets',
    damage: 10,
    crouchDamage: 3,
    pelletCount: 8,
    fireRate: 1,
    magazine: 6,
    reserve: 18,
    reload: 2.5,
    range: 'short',
    zoom: 1,
  },
  SMAW: {
    id: 'SMAW',
    name: 'SMAW',
    group: 'launcher',
    behaviour: 'rocket',
    damage: 100,
    crouchDamage: 70,
    directHitDamage: 100,
    crouchDirectHitDamage: 70,
    splashDamage: 50,
    crouchSplashDamage: 40,
    fireRate: 0.5,
    magazine: 1,
    reserve: 4,
    reload: 2.5,
    range: 'long',
    zoom: 1.4,
  },
  RG6: {
    id: 'RG6',
    name: 'RG6',
    group: 'launcher',
    behaviour: 'grenade-launcher',
    damage: 50,
    crouchDamage: 40,
    splashDamage: 50,
    crouchSplashDamage: 40,
    fireRate: 1.5,
    magazine: 6,
    reserve: 12,
    reload: 3.0,
    range: 'medium',
    zoom: 1.2,
  },
  Flame: {
    id: 'Flame',
    name: 'Flame',
    group: 'special',
    behaviour: 'flame',
    damage: 4,
    crouchDamage: 3,
    fireRate: 20,
    magazine: 100,
    fuelCapacity: 100,
    reserve: null,
    reload: null,
    range: 'very-short',
    zoom: 1,
  },
  Phasr: {
    id: 'Phasr',
    name: 'Phasr',
    group: 'special',
    behaviour: 'laser',
    damage: 20,
    crouchDamage: 7,
    fireRate: 4,
    magazine: 12,
    reserve: 36,
    reload: 2.0,
    range: 'long',
    zoom: 1.6,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
