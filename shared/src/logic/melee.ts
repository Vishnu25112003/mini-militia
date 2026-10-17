import { MATCH_RULES } from '../config/matchRules.js';
import type { PlayerState } from '../types/player.js';

export function canMelee(state: PlayerState): boolean {
  return state.alive && state.meleeCooldownRemainingSeconds <= 0;
}

/** Starts the melee cooldown — caller must already have checked `canMelee`. */
export function performMeleeSwing(state: PlayerState): PlayerState {
  return { ...state, meleeCooldownRemainingSeconds: MATCH_RULES.meleeCooldownSeconds };
}

export function tickMeleeCooldown(state: PlayerState, dt: number): PlayerState {
  if (state.meleeCooldownRemainingSeconds <= 0) return state;
  return { ...state, meleeCooldownRemainingSeconds: Math.max(0, state.meleeCooldownRemainingSeconds - dt) };
}

export function isWithinMeleeRange(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.hypot(ax - bx, ay - by) <= MATCH_RULES.meleeRangePx;
}

export interface MeleeClashResult {
  firstHitterHealthAfter: number;
  /** True when the first hitter's own health was 50 or less before the clash. */
  firstHitterDies: boolean;
}

/**
 * A regular melee hit always kills its target outright, ignoring health,
 * crouch shield, and spawn shield.
 *
 * A clash (both players swing at nearly the same time) is the one exception:
 * the player who lands first still gets the kill, but only loses a fixed 50
 * health themselves rather than dying outright — unless they were already at
 * 50 health or less, in which case they die too.
 */
export function resolveMeleeClash(firstHitterHealthBefore: number): MeleeClashResult {
  return {
    firstHitterHealthAfter: Math.max(
      0,
      firstHitterHealthBefore - MATCH_RULES.meleeClashFirstHitterLoss,
    ),
    firstHitterDies: firstHitterHealthBefore <= MATCH_RULES.meleeClashFirstHitterLoss,
  };
}
