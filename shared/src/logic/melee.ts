import { MATCH_RULES } from '../config/matchRules.js';

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
