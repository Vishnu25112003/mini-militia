// Core data types shared by the server and the browser (Phase 01).

// ---------- guns & grenades ----------
export const GUN_IDS = [
  'ak47',
  'm16',
  'tavor',
  'xm8',
  'm14',
  'm93ba',
  'uzi',
  'mp5',
  'tec9',
  'desert_eagle',
  'shotgun',
  'smaw',
  'rg6',
  'flame',
  'phasr',
] as const;
export type GunId = (typeof GUN_IDS)[number];

/** Only these three guns can be dual-wielded. */
export type DualGunId = 'tec9' | 'uzi' | 'desert_eagle';

export const GRENADE_IDS = ['frag', 'gas', 'proxy'] as const;
export type GrenadeId = (typeof GRENADE_IDS)[number];

export interface GunAmmo {
  magazine: number;
  reserve: number;
}

/** What a slot holds, without ammo (used for the host's default loadout). */
export type SlotSpec = { kind: 'single'; gun: GunId } | { kind: 'pair'; guns: [DualGunId, DualGunId] };

/** A gun slot: a single gun, or a dual pair that counts as ONE slot. A slot is never empty. */
export type Slot =
  | { kind: 'single'; gun: GunId; ammo: GunAmmo }
  | { kind: 'pair'; guns: [DualGunId, DualGunId]; ammo: [GunAmmo, GunAmmo] };

export type GrenadeInventory = Record<GrenadeId, number>;

// ---------- input ----------
/** One tick of player input. Browsers send only this; the server runs the game. */
export interface PlayerInput {
  /** Increasing sequence number, echoed back so the client can reconcile prediction. */
  seq: number;
  /** -1 (left) .. +1 (right) */
  moveX: number;
  fly: boolean;
  crouch: boolean;
  /** Aim direction in radians, 0 = right, +PI/2 = down (screen coordinates). */
  aimAngle: number;
  fire: boolean;
  melee: boolean;
  throwGrenade: boolean;
  /** Cycle frag -> gas -> proxy (Q on PC, grenade icon on touch). */
  switchGrenade: boolean;
  reload: boolean;
  /** Swap gun slot 1 <-> 2. */
  swapWeapon: boolean;
  /** Pickup / Pair button. */
  pickup: boolean;
}

// ---------- player ----------
export type PlayerColorId = number; // 0..7

export interface PlayerState {
  id: string;
  name: string;
  color: PlayerColorId;

  /** Feet position (bottom-centre of the hitbox) in pixels. y grows downward. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** +1 looking right, -1 looking left (follows the aim). Decides front vs back for the crouch shield. */
  facing: 1 | -1;
  crouching: boolean;
  onGround: boolean;
  /** Jetpack currently thrusting (for animation). */
  flying: boolean;

  health: number;
  /** Jetpack fuel, 0..fuelCapacity. */
  fuel: number;
  alive: boolean;
  /** Seconds of spawn shield left. */
  shieldTimer: number;

  slots: [Slot, Slot];
  activeSlot: 0 | 1;
  grenades: GrenadeInventory;
  selectedGrenade: GrenadeId;

  kills: number;
  deaths: number;
  points: number;
  /** Kills in the current life; decides whether a death costs a point. */
  killsThisLife: number;

  /** Last input sequence number the server has applied (for client reconciliation). */
  lastInputSeq: number;
}

// ---------- match ----------
export interface HostSettings {
  /** Room size, 2..8 */
  playerCount: number;
  /** Seconds, 60..900 */
  gameTimeSec: number;
  /** Seconds before dropped / scattered items disappear, 5..60 */
  mapDropsSec: number;
  /** 0..100: 100 = normal gravity, 0 = none */
  gravity: number;
  /** 0..100: 100 = unlimited jetpack, 0 = very fast drain */
  boost: number;
  defaultLoadout: boolean;
  /** The host's chosen loadout (slot 1 + slot 2). Only used when `defaultLoadout` is on. */
  loadout: [SlotSpec, SlotSpec] | null;
}

export type MatchPhase = 'lobby' | 'playing' | 'ended';

export type PickupKind = 'gun' | 'medkit' | 'grenades' | 'boost';

export interface PickupItem {
  id: string;
  /** Index of the map pickup spot (0..13), or -1 for dropped / scattered items. */
  spotIndex: number;
  kind: PickupKind;
  gun?: GunId;
  grenade?: GrenadeId;
  /** Grenade pickups come in pairs. */
  count?: number;
  x: number;
  y: number;
}
