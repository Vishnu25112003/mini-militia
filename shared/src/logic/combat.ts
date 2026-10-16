import { WEAPONS, type WeaponStats } from '../config/weapons.js';
import { raySegmentHitsAabb, raycastWallDistance } from '../physics/raycast.js';
import { PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH } from '../physics/step.js';
import type { CollisionMap } from '../physics/map.js';
import type { DamageParams, HitDirection } from './damage.js';
import { isFrontHit } from './damage.js';
import type { Facing, PlayerState, Slot } from '../types/player.js';

/**
 * No per-weapon falloff is specified by the flow — a hit anywhere along a
 * clear line of sight deals full damage. This just has to exceed the
 * Catacombs map's diagonal so a shot is never cut short by "range".
 */
export const MAX_HITSCAN_RANGE_PX = 4000;

/** The weapon(s) a slot fires — one gun, or both guns of a dual pair together. */
function weaponsInSlot(slot: Slot): WeaponStats[] {
  return slot.kind === 'single' ? [WEAPONS[slot.weapon]] : slot.weapons.map((id) => WEAPONS[id]);
}

/**
 * A dual pair fires both guns on one shared clock — using the first gun's
 * fire rate/magazine/reload as that clock. Precise mixed-pair timing is a
 * Phase 08 ("full weapon set") refinement; this phase is AK47-only.
 */
function timingWeaponForSlot(slot: Slot): WeaponStats {
  return slot.kind === 'single' ? WEAPONS[slot.weapon] : WEAPONS[slot.weapons[0]];
}

function slotHasAmmo(slot: Slot): boolean {
  return slot.kind === 'single' ? slot.ammoInMagazine > 0 : slot.ammoInMagazine[0] > 0 && slot.ammoInMagazine[1] > 0;
}

/** Can the player's active slot fire right now? */
export function canFireActiveSlot(state: PlayerState): boolean {
  if (!state.alive) return false;
  const slot = state.slots[state.activeSlotIndex];
  return slot.cooldownRemainingSeconds <= 0 && slot.reloadRemainingSeconds <= 0 && slotHasAmmo(slot);
}

function fireSlot(slot: Slot): Slot {
  const timing = timingWeaponForSlot(slot);
  const cooldownRemainingSeconds = 1 / timing.fireRate;

  if (slot.kind === 'single') {
    return { ...slot, ammoInMagazine: slot.ammoInMagazine - 1, cooldownRemainingSeconds };
  }
  return {
    ...slot,
    ammoInMagazine: [slot.ammoInMagazine[0] - 1, slot.ammoInMagazine[1] - 1],
    cooldownRemainingSeconds,
  };
}

/** Fires the active slot — caller must already have checked `canFireActiveSlot`. */
export function fireActiveSlot(state: PlayerState): { state: PlayerState; weaponsFired: WeaponStats[] } {
  const slot = state.slots[state.activeSlotIndex];
  const weaponsFired = weaponsInSlot(slot);
  const nextSlot = fireSlot(slot);
  const slots = [...state.slots] as [Slot, Slot];
  slots[state.activeSlotIndex] = nextSlot;
  return { state: { ...state, slots }, weaponsFired };
}

function slotNeedsReload(slot: Slot): boolean {
  if (slot.reloadRemainingSeconds > 0) return false;
  return slot.kind === 'single'
    ? slot.ammoInMagazine < WEAPONS[slot.weapon].magazine && slot.ammoReserve > 0
    : (slot.ammoInMagazine[0] < WEAPONS[slot.weapons[0]].magazine && slot.ammoReserve[0] > 0) ||
        (slot.ammoInMagazine[1] < WEAPONS[slot.weapons[1]].magazine && slot.ammoReserve[1] > 0);
}

/** Starts a reload on the active slot, if it needs one and isn't already reloading. */
export function startReloadActiveSlot(state: PlayerState): PlayerState {
  const slot = state.slots[state.activeSlotIndex];
  if (!state.alive || !slotNeedsReload(slot)) return state;

  const reloadRemainingSeconds = timingWeaponForSlot(slot).reload ?? 0;
  if (reloadRemainingSeconds <= 0) return state;

  const slots = [...state.slots] as [Slot, Slot];
  slots[state.activeSlotIndex] = { ...slot, reloadRemainingSeconds };
  return { ...state, slots };
}

/** Toggles the active slot (1 ↔ 2). */
export function swapActiveSlot(state: PlayerState): PlayerState {
  if (!state.alive) return state;
  return { ...state, activeSlotIndex: state.activeSlotIndex === 0 ? 1 : 0 };
}

function completeReload(slot: Slot): Slot {
  if (slot.kind === 'single') {
    const magazine = WEAPONS[slot.weapon].magazine;
    const drawn = Math.min(magazine - slot.ammoInMagazine, slot.ammoReserve);
    return { ...slot, ammoInMagazine: slot.ammoInMagazine + drawn, ammoReserve: slot.ammoReserve - drawn };
  }
  const [weaponA, weaponB] = slot.weapons;
  const drawnA = Math.min(WEAPONS[weaponA].magazine - slot.ammoInMagazine[0], slot.ammoReserve[0]);
  const drawnB = Math.min(WEAPONS[weaponB].magazine - slot.ammoInMagazine[1], slot.ammoReserve[1]);
  return {
    ...slot,
    ammoInMagazine: [slot.ammoInMagazine[0] + drawnA, slot.ammoInMagazine[1] + drawnB],
    ammoReserve: [slot.ammoReserve[0] - drawnA, slot.ammoReserve[1] - drawnB],
  };
}

function tickSlotTimers(slot: Slot, dt: number): Slot {
  const cooldownRemainingSeconds = Math.max(0, slot.cooldownRemainingSeconds - dt);
  if (slot.reloadRemainingSeconds <= 0) {
    return slot.cooldownRemainingSeconds === cooldownRemainingSeconds ? slot : { ...slot, cooldownRemainingSeconds };
  }

  const reloadRemainingSeconds = Math.max(0, slot.reloadRemainingSeconds - dt);
  const ticked = { ...slot, cooldownRemainingSeconds, reloadRemainingSeconds };
  return reloadRemainingSeconds === 0 ? completeReload(ticked) : ticked;
}

/**
 * Advances both slots' cooldown/reload clocks and the spawn shield by `dt`
 * seconds. Both slots tick regardless of which is active, so swapping away
 * from a reloading gun doesn't pause it.
 */
export function tickCombatTimers(state: PlayerState, dt: number): PlayerState {
  const slots = state.slots.map((slot) => tickSlotTimers(slot, dt)) as [Slot, Slot];
  const shieldSecondsRemaining = Math.max(0, state.shieldSecondsRemaining - dt);
  return { ...state, slots, shieldSecondsRemaining };
}

export interface HitscanTarget {
  id: string;
  x: number;
  y: number;
  facing: Facing;
}

export interface HitscanResult {
  targetId: string;
  hitDirection: HitDirection;
}

/**
 * Traces a shot from `(originX, originY)` along `angle`: stops at the first
 * wall, then returns the closest player hit before that wall (if any).
 */
export function resolveHitscanShot(
  map: CollisionMap,
  originX: number,
  originY: number,
  angle: number,
  targets: readonly HitscanTarget[],
): HitscanResult | null {
  const wallDistance = raycastWallDistance(map, originX, originY, angle, MAX_HITSCAN_RANGE_PX);

  let closest: { target: HitscanTarget; distance: number } | null = null;
  for (const target of targets) {
    const result = raySegmentHitsAabb(
      originX,
      originY,
      angle,
      wallDistance,
      target.x,
      target.y,
      PLAYER_HALF_WIDTH,
      PLAYER_HALF_HEIGHT,
    );
    if (result.hit && (!closest || result.distance < closest.distance)) {
      closest = { target, distance: result.distance };
    }
  }

  if (!closest) return null;
  return {
    targetId: closest.target.id,
    hitDirection: isFrontHit(closest.target.facing, originX, closest.target.x),
  };
}

/** Sums the fired weapon(s)' damage — a dual pair hits with both guns at once. */
export function damageParamsForShot(weaponsFired: readonly WeaponStats[], hitDirection: HitDirection): DamageParams {
  return {
    amount: weaponsFired.reduce((sum, w) => sum + w.damage, 0),
    crouchAmount: weaponsFired.reduce((sum, w) => sum + w.crouchDamage, 0),
    hitDirection,
  };
}
