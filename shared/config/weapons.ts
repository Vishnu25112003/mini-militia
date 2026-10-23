import type { GunId } from '../types';

// Gun stats. Source of truth: Game Flow, Section 7 "Gun stats (approved starting values — tune in playtesting)".
// Health is 100. "crouchDamage" = damage to a crouching player hit on the FRONT side.

export type GunBehaviour =
  | 'hitscan_auto'
  | 'hitscan_burst'
  | 'hitscan_precision'
  | 'pellet'
  | 'rocket'
  | 'grenade_launcher'
  | 'stream';

export type RangeClass =
  'very_short' | 'short' | 'short_medium' | 'medium' | 'medium_long' | 'long' | 'very_long';

/**
 * "Range" words from the flow converted to pixels (32 px tiles).
 * PLACEHOLDER values — tune during build (Phase 08 / 16).
 */
export const RANGE_PX: Record<RangeClass, number> = {
  very_short: 120,
  short: 260,
  short_medium: 360,
  medium: 520,
  medium_long: 680,
  long: 900,
  very_long: 1300,
};

export interface SplashConfig {
  damage: number;
  /** Damage to a crouching player hit on the front. */
  crouchDamage: number;
  /** Blast radius in px. PLACEHOLDER — open question for Phase 08 (splash radius for SMAW / RG6). */
  radiusPx: number;
}

export interface GunConfig {
  id: GunId;
  name: string;
  group: 'assault' | 'marksman' | 'smg_pistol' | 'shotgun' | 'launcher' | 'special';
  behaviour: GunBehaviour;
  /** Damage per hit / pellet / flame tick / direct hit. */
  damage: number;
  /** Damage per hit to a crouching player hit on the front. */
  crouchDamage: number;
  /** Shots per second (flame: ticks per second). */
  fireRate: number;
  /** Magazine size (flame: fuel). */
  magazine: number;
  /** Spare ammo (flame: none). */
  reserve: number;
  /** Seconds; 0 = cannot be reloaded (flame). */
  reloadSec: number;
  range: RangeClass;
  /** Camera zoom while using this gun. */
  zoom: number;
  /** Shots in one burst (M16). */
  burstSize?: number;
  /** Pellets per shot (shotgun). */
  pellets?: number;
  /** Explosion on hit (SMAW, RG6). */
  splash?: SplashConfig;
  /** True for Uzi / TEC9 / Desert Eagle. */
  dualCapable: boolean;
}

export const GUNS: Record<GunId, GunConfig> = {
  ak47: {
    id: 'ak47',
    name: 'AK47',
    group: 'assault',
    behaviour: 'hitscan_auto',
    damage: 14,
    crouchDamage: 5,
    fireRate: 8,
    magazine: 30,
    reserve: 90,
    reloadSec: 2.0,
    range: 'medium',
    zoom: 1.4,
    dualCapable: false,
  },
  m16: {
    id: 'm16',
    name: 'M16',
    group: 'assault',
    behaviour: 'hitscan_burst',
    damage: 12,
    crouchDamage: 4,
    fireRate: 9,
    magazine: 30,
    reserve: 90,
    reloadSec: 1.8,
    range: 'medium',
    zoom: 1.4,
    burstSize: 3,
    dualCapable: false,
  },
  tavor: {
    id: 'tavor',
    name: 'Tavor',
    group: 'assault',
    behaviour: 'hitscan_auto',
    damage: 11,
    crouchDamage: 4,
    fireRate: 10,
    magazine: 30,
    reserve: 90,
    reloadSec: 1.8,
    range: 'medium',
    zoom: 1.2,
    dualCapable: false,
  },
  xm8: {
    id: 'xm8',
    name: 'XM8',
    group: 'assault',
    behaviour: 'hitscan_auto',
    damage: 13,
    crouchDamage: 4,
    fireRate: 8,
    magazine: 30,
    reserve: 90,
    reloadSec: 1.8,
    range: 'medium_long',
    zoom: 1.6,
    dualCapable: false,
  },
  m14: {
    id: 'm14',
    name: 'M14',
    group: 'marksman',
    behaviour: 'hitscan_precision',
    damage: 30,
    crouchDamage: 10,
    fireRate: 3,
    magazine: 15,
    reserve: 45,
    reloadSec: 2.2,
    range: 'long',
    zoom: 2,
    dualCapable: false,
  },
  m93ba: {
    id: 'm93ba',
    name: 'M93BA',
    group: 'marksman',
    behaviour: 'hitscan_precision',
    damage: 95,
    crouchDamage: 30,
    fireRate: 0.8,
    magazine: 5,
    reserve: 15,
    reloadSec: 3.0,
    range: 'very_long',
    zoom: 3,
    dualCapable: false,
  },
  uzi: {
    id: 'uzi',
    name: 'Uzi',
    group: 'smg_pistol',
    behaviour: 'hitscan_auto',
    damage: 7,
    crouchDamage: 2,
    fireRate: 14,
    magazine: 30,
    reserve: 90,
    reloadSec: 1.5,
    range: 'short',
    zoom: 1,
    dualCapable: true,
  },
  mp5: {
    id: 'mp5',
    name: 'MP5',
    group: 'smg_pistol',
    behaviour: 'hitscan_auto',
    damage: 8,
    crouchDamage: 3,
    fireRate: 12,
    magazine: 30,
    reserve: 90,
    reloadSec: 1.6,
    range: 'short_medium',
    zoom: 1.2,
    dualCapable: false,
  },
  tec9: {
    id: 'tec9',
    name: 'TEC9',
    group: 'smg_pistol',
    behaviour: 'hitscan_auto',
    damage: 7,
    crouchDamage: 2,
    fireRate: 12,
    magazine: 20,
    reserve: 80,
    reloadSec: 1.4,
    range: 'short',
    zoom: 1,
    dualCapable: true,
  },
  desert_eagle: {
    id: 'desert_eagle',
    name: 'Desert Eagle',
    group: 'smg_pistol',
    behaviour: 'hitscan_precision',
    damage: 28,
    crouchDamage: 9,
    fireRate: 3,
    magazine: 7,
    reserve: 28,
    reloadSec: 1.6,
    range: 'medium',
    zoom: 1.2,
    dualCapable: true,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    group: 'shotgun',
    behaviour: 'pellet',
    // 10 damage x 8 pellets; 3 per pellet when the target crouches
    damage: 10,
    crouchDamage: 3,
    fireRate: 1,
    magazine: 6,
    reserve: 18,
    reloadSec: 2.5,
    range: 'short',
    zoom: 1,
    pellets: 8,
    dualCapable: false,
  },
  smaw: {
    id: 'smaw',
    name: 'SMAW',
    group: 'launcher',
    behaviour: 'rocket',
    // direct hit 100 (instant kill) / crouch front 70; splash 50 / crouch front 40
    damage: 100,
    crouchDamage: 70,
    fireRate: 0.5,
    magazine: 1,
    reserve: 4,
    reloadSec: 2.5,
    range: 'long',
    zoom: 1.4,
    splash: { damage: 50, crouchDamage: 40, radiusPx: 96 },
    dualCapable: false,
  },
  rg6: {
    id: 'rg6',
    name: 'RG6',
    group: 'launcher',
    behaviour: 'grenade_launcher',
    // splash only: 50 / crouch front 40
    damage: 50,
    crouchDamage: 40,
    fireRate: 1.5,
    magazine: 6,
    reserve: 12,
    reloadSec: 3.0,
    range: 'medium',
    zoom: 1.2,
    splash: { damage: 50, crouchDamage: 40, radiusPx: 80 },
    dualCapable: false,
  },
  flame: {
    id: 'flame',
    name: 'Flame',
    group: 'special',
    behaviour: 'stream',
    // 4 per tick (crouch front 3) + a short burn. Burn duration / dps are an open question (Phase 08).
    damage: 4,
    crouchDamage: 3,
    fireRate: 20,
    magazine: 100,
    reserve: 0,
    reloadSec: 0,
    range: 'very_short',
    zoom: 1,
    dualCapable: false,
  },
  phasr: {
    id: 'phasr',
    name: 'Phasr',
    group: 'special',
    behaviour: 'hitscan_precision',
    damage: 20,
    crouchDamage: 7,
    fireRate: 4,
    magazine: 12,
    reserve: 36,
    reloadSec: 2.0,
    range: 'long',
    zoom: 1.6,
    dualCapable: false,
  },
};

export const GUN_LIST: readonly GunConfig[] = Object.values(GUNS);
