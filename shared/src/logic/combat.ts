import { WEAPONS, type WeaponStats } from '../config/weapons.js';
import { WEAPON_RANGE_PX } from '../config/weaponRange.js';
import { raySegmentHitsAabb, raycastWallDistance } from '../physics/raycast.js';
import { PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH } from '../physics/step.js';
import type { CollisionMap } from '../physics/map.js';
import type { DamageParams, HitDirection } from './damage.js';
import { isFrontHit } from './damage.js';
import type { Facing, PlayerState, Slot } from '../types/player.js';

/** How a slot's weapon(s) resolve a trigger pull — everything but the two explosive launchers is one or more hitscan rays. */
export type FireKind = 'hitscan' | 'projectile';

/** A 3-round burst (M16) fires all 3 rounds as separate rays on the same tick — real sub-tick burst timing is a later-phase refinement. */
const SHOTGUN_PELLET_SPREAD_RADIANS = 0.18;

export function fireKindForWeapon(weapon: WeaponStats): FireKind {
  return weapon.behaviour === 'rocket' || weapon.behaviour === 'grenade-launcher' ? 'projectile' : 'hitscan';
}

/**
 * How many separate hitscan rays one trigger pull resolves — 1 normally, the
 * pellet count for the Shotgun (fixed, one shell always fires all pellets),
 * or `roundsFired` for a burst (capped to however many rounds a partial
 * burst — magazine ran dry mid-burst — actually fired).
 */
function hitscanRayCount(weapon: WeaponStats, roundsFired: number): number {
  if (weapon.behaviour === 'burst') return roundsFired;
  if (weapon.behaviour === 'shotgun-pellets') return weapon.pelletCount ?? 1;
  return 1;
}

/** Random per-pellet spread for the Shotgun; every other weapon fires dead-on. */
function rayAngle(weapon: WeaponStats, baseAngle: number): number {
  if (weapon.behaviour !== 'shotgun-pellets') return baseAngle;
  return baseAngle + (Math.random() * 2 - 1) * SHOTGUN_PELLET_SPREAD_RADIANS;
}

/** The weapon(s) a slot fires — one gun, or both guns of a dual pair together. Dual pairs are always hitscan-automatic (TEC9/Uzi/Desert Eagle). */
function weaponsInSlot(slot: Slot): WeaponStats[] {
  return slot.kind === 'single' ? [WEAPONS[slot.weapon]] : slot.weapons.map((id) => WEAPONS[id]);
}

/**
 * A dual pair fires both guns on one shared clock — using the first gun's
 * fire rate/magazine/reload as that clock (both are always hitscan-automatic,
 * so their fire rates only ever differ slightly, e.g. Desert Eagle + Uzi).
 */
function timingWeaponForSlot(slot: Slot): WeaponStats {
  return slot.kind === 'single' ? WEAPONS[slot.weapon] : WEAPONS[slot.weapons[0]];
}

/** M16's 3-round burst spends 3 rounds per trigger pull; everything else (including the Shotgun's one shell) spends 1. */
function ammoCostForFire(weapon: WeaponStats): number {
  return weapon.behaviour === 'burst' ? (weapon.burstSize ?? 1) : 1;
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

function fireSlot(slot: Slot): { slot: Slot; roundsFired: number } {
  const timing = timingWeaponForSlot(slot);
  const cooldownRemainingSeconds = 1 / timing.fireRate;
  const cost = ammoCostForFire(timing);

  if (slot.kind === 'single') {
    const roundsFired = Math.min(cost, slot.ammoInMagazine);
    return {
      slot: { ...slot, ammoInMagazine: slot.ammoInMagazine - roundsFired, cooldownRemainingSeconds },
      roundsFired,
    };
  }

  // Dual pairs are always cost-1 (hitscan-automatic), so both guns fire exactly once.
  const roundsFiredA = Math.min(cost, slot.ammoInMagazine[0]);
  const roundsFiredB = Math.min(cost, slot.ammoInMagazine[1]);
  return {
    slot: {
      ...slot,
      ammoInMagazine: [slot.ammoInMagazine[0] - roundsFiredA, slot.ammoInMagazine[1] - roundsFiredB],
      cooldownRemainingSeconds,
    },
    roundsFired: Math.min(roundsFiredA, roundsFiredB),
  };
}

/**
 * Fires the active slot — caller must already have checked `canFireActiveSlot`.
 * `rayAngles` lists the angle(s) to resolve (via `resolveHitscanShot`) for a
 * `fireKind: 'hitscan'` result — more than one for a burst or a shotgun
 * spread. A `'projectile'` result fires nothing itself; the caller spawns a
 * projectile (`shared/src/physics/projectile.ts`) instead.
 */
export function fireActiveSlot(
  state: PlayerState,
  aimAngle: number,
): { state: PlayerState; weaponsFired: WeaponStats[]; fireKind: FireKind; rayAngles: number[] } {
  const slot = state.slots[state.activeSlotIndex];
  const weaponsFired = weaponsInSlot(slot);
  const timing = timingWeaponForSlot(slot);
  const { slot: nextSlot, roundsFired } = fireSlot(slot);
  const slots = [...state.slots] as [Slot, Slot];
  slots[state.activeSlotIndex] = nextSlot;

  const fireKind = fireKindForWeapon(timing);
  const rayCount = fireKind === 'hitscan' ? hitscanRayCount(timing, roundsFired) : 0;
  const rayAngles = Array.from({ length: rayCount }, () => rayAngle(timing, aimAngle));

  return { state: { ...state, slots }, weaponsFired, fireKind, rayAngles };
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
 * wall or `maxDistance` (the firing weapon's own range, converted from its
 * category in `config/weaponRange.ts`), then returns the closest player hit
 * before that cutoff (if any).
 */
export function resolveHitscanShot(
  map: CollisionMap,
  originX: number,
  originY: number,
  angle: number,
  maxDistance: number,
  targets: readonly HitscanTarget[],
): HitscanResult | null {
  const wallDistance = raycastWallDistance(map, originX, originY, angle, maxDistance);

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

/** The hitscan cutoff for a shot — the shortest range among the weapon(s) fired (relevant only for a mixed dual pair). */
export function hitscanRangeForWeapons(weaponsFired: readonly WeaponStats[]): number {
  return Math.min(...weaponsFired.map((w) => WEAPON_RANGE_PX[w.range]));
}

export interface SplashTarget {
  id: string;
  x: number;
  y: number;
  crouching: boolean;
  facing: Facing;
}

export interface SplashHit {
  targetId: string;
  params: DamageParams;
  isDirect: boolean;
}

/**
 * Resolves an explosion (SMAW rocket or RG6 grenade impact) against every
 * candidate target: the one actually struck by the projectile (if any) takes
 * `directHitDamage`, everyone else within `splashRadiusPx` takes
 * `splashDamage` — both already carry their own crouch-front numbers in
 * `weapons.ts` (not derived from the general 0.8× explosion multiplier,
 * since the flow publishes SMAW/RG6's crouch numbers explicitly). The
 * shooter is a normal candidate target — SMAW/RG6 self-damage exactly as
 * they would an opponent, per the flow.
 */
export function resolveSplashDamage(
  weapon: WeaponStats,
  impactX: number,
  impactY: number,
  splashRadiusPx: number,
  directHitTargetId: string | null,
  targets: readonly SplashTarget[],
): SplashHit[] {
  const hits: SplashHit[] = [];

  for (const target of targets) {
    const isDirect = target.id === directHitTargetId;
    const distance = Math.hypot(target.x - impactX, target.y - impactY);
    if (!isDirect && distance > splashRadiusPx) continue;

    const amount = isDirect ? (weapon.directHitDamage ?? weapon.damage) : (weapon.splashDamage ?? 0);
    if (amount <= 0) continue;
    const crouchAmount = isDirect ? weapon.crouchDirectHitDamage : weapon.crouchSplashDamage;

    hits.push({
      targetId: target.id,
      isDirect,
      params: {
        amount,
        crouchAmount,
        hitDirection: isFrontHit(target.facing, impactX, target.x),
      },
    });
  }

  return hits;
}
