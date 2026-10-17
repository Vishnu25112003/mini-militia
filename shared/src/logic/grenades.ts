import { GRENADE_IDS, type GrenadeId } from '../config/grenades.js';
import { MATCH_RULES } from '../config/matchRules.js';
import type { GrenadeInventory, PlayerState } from '../types/player.js';

/** The next grenade type with a non-zero count, cycling frag → gas → proxy → frag. Stays put if nothing else is available. */
export function nextAvailableGrenade(grenades: GrenadeInventory, from: GrenadeId): GrenadeId {
  const startIndex = GRENADE_IDS.indexOf(from);
  for (let step = 1; step <= GRENADE_IDS.length; step++) {
    const candidate = GRENADE_IDS[(startIndex + step) % GRENADE_IDS.length]!;
    if (grenades[candidate] > 0) return candidate;
  }
  return from; // nothing else available
}

/** Cycles the selected grenade type, skipping types at 0 — a no-op if every type is empty. */
export function switchGrenadeType(state: PlayerState): PlayerState {
  if (!state.alive) return state;
  return { ...state, selectedGrenade: nextAvailableGrenade(state.grenades, state.selectedGrenade) };
}

export function canThrowGrenade(state: PlayerState): boolean {
  return state.alive && state.grenadeThrowCooldownRemainingSeconds <= 0 && state.grenades[state.selectedGrenade] > 0;
}

/** Spends one of the selected grenade, starts the throw cooldown, and auto-switches selection if that type just ran out. */
export function throwGrenade(state: PlayerState): { state: PlayerState; thrown: GrenadeId } {
  const thrown = state.selectedGrenade;
  const grenades = { ...state.grenades, [thrown]: state.grenades[thrown] - 1 };
  const selectedGrenade = grenades[thrown] > 0 ? thrown : nextAvailableGrenade(grenades, thrown);

  return {
    state: {
      ...state,
      grenades,
      selectedGrenade,
      grenadeThrowCooldownRemainingSeconds: MATCH_RULES.grenadeThrowCooldownSeconds,
    },
    thrown,
  };
}

/** Decrements the throw cooldown by `dt` seconds. */
export function tickGrenadeThrowCooldown(state: PlayerState, dt: number): PlayerState {
  if (state.grenadeThrowCooldownRemainingSeconds <= 0) return state;
  return {
    ...state,
    grenadeThrowCooldownRemainingSeconds: Math.max(0, state.grenadeThrowCooldownRemainingSeconds - dt),
  };
}
