import type { WeaponId } from '../config/weapons.js';
import type { GrenadeId } from '../config/grenades.js';
import type { PlayerColor } from '../config/identity.js';

export interface Vector2 {
  x: number;
  y: number;
}

export type Facing = 'left' | 'right';

/** One input sample from a client for one physics tick. */
export interface PlayerInput {
  /** -1 (left), 0 (none), or 1 (right). */
  moveX: -1 | 0 | 1;
  fly: boolean;
  crouch: boolean;
  /** Aim direction in radians. */
  aimAngle: number;
  fire: boolean;
  melee: boolean;
  throwGrenade: boolean;
  /** Cycles the selected grenade type (frag → gas → proxy), skipping types at 0. */
  switchGrenade: boolean;
  reload: boolean;
  swapSlot: boolean;
  pickupOrPair: boolean;
  /** Monotonically increasing per-client counter, for reconciliation. */
  sequence: number;
}

export type SingleSlot = {
  kind: 'single';
  weapon: WeaponId;
  ammoInMagazine: number;
  ammoReserve: number;
  /** Seconds left before this slot's gun can fire again; 0 = ready. */
  cooldownRemainingSeconds: number;
  /** Seconds left in an in-progress reload; 0 = not reloading. */
  reloadRemainingSeconds: number;
};

export type DualSlot = {
  kind: 'dual';
  weapons: readonly [WeaponId, WeaponId];
  ammoInMagazine: readonly [number, number];
  ammoReserve: readonly [number, number];
  /** Both guns of a dual pair fire together, so they share one cooldown/reload clock. */
  cooldownRemainingSeconds: number;
  reloadRemainingSeconds: number;
};

export type Slot = SingleSlot | DualSlot;

export type GrenadeInventory = Record<GrenadeId, number>;

export interface PlayerState {
  id: string;
  name: string;
  color: PlayerColor;
  position: Vector2;
  velocity: Vector2;
  facing: Facing;
  health: number;
  fuel: number;
  crouching: boolean;
  onGround: boolean;
  slots: readonly [Slot, Slot];
  activeSlotIndex: 0 | 1;
  grenades: GrenadeInventory;
  /** Which grenade type the throw button throws right now. */
  selectedGrenade: GrenadeId;
  /** Seconds left before another grenade can be thrown; 0 = ready. */
  grenadeThrowCooldownRemainingSeconds: number;
  /** Seconds left before another melee swing can be made; 0 = ready. */
  meleeCooldownRemainingSeconds: number;
  kills: number;
  deaths: number;
  points: number;
  /** Has this player gotten a kill since their last spawn? Drives the death penalty rule. */
  gotKillThisLife: boolean;
  /** Seconds of spawn shield remaining; 0 once it has expired. */
  shieldSecondsRemaining: number;
  alive: boolean;
}
