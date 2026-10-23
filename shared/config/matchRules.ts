import type { GrenadeInventory } from '../types';

// Match rules. Source of truth: Game Flow, Sections 2, 3, 6, 7, 8, 9, 10, 15.

export const MATCH_RULES = {
  /** Health of every player (Section 7). */
  maxHealth: 100,

  /** Seconds a dead player waits before respawning (Section 3). */
  respawnWaitSec: 5,
  /** Seconds of spawn shield after every spawn (Section 3). Melee ignores it. */
  spawnShieldSec: 3,

  /** Grenades every player spawns with: 2 frag + 2 gas, never proxy (Section 3). */
  spawnGrenades: { frag: 2, gas: 2, proxy: 0 } satisfies GrenadeInventory,
  /** Max grenades carried in total, any mix (Section 7). */
  grenadeCarryLimit: 5,

  /** Pickup refresh cycle (Section 6): items stay 60 s, all vanish, 5 s later a fresh set appears. */
  pickupVisibleSec: 60,
  pickupGapSec: 5,

  /** Medkit heals to full; boost tank refills fully (Sections 7, 10). */
  medkitHealsToFull: true,
  boostTankRefillsToFull: true,

  /** Melee: one hit always kills. In a clash the FIRST hitter loses a fixed amount (Section 9). */
  meleeClashFirstHitterLoss: 50,

  /** Explosion damage to a crouching player hit on the front is x0.8 (Section 8). */
  explosionCrouchMultiplier: 0.8,

  /** Lobby auto-start timer, seconds (Section 2). */
  lobbyAutoStartSec: 120,

  /** Server game loop and snapshot rates, per second (Section 15). */
  tickRate: 30,
  snapshotRate: 20,
} as const;

/** Fixed simulation timestep in seconds (matches the 30 Hz server tick). */
export const TICK_DT = 1 / MATCH_RULES.tickRate;
