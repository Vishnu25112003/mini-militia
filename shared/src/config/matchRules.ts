export const MATCH_RULES = {
  maxHealth: 100,
  respawnWaitSeconds: 5,
  spawnShieldSeconds: 3,
  spawnFragnades: 2,
  spawnGasnades: 2,
  grenadeCarryLimit: 5,
  pickupVisibleSeconds: 60,
  pickupRefreshGapSeconds: 5,
  /** Instant heal to maxHealth above, not a partial amount. */
  medkitHeal: 'full',
  /** Instant refill to MOVEMENT.fuelCapacity, not a partial amount. */
  boostTankRefill: 'full',
  meleeClashFirstHitterLoss: 50,
  /** Front-side damage multiplier for explosions, gas, and flame on a crouching player. */
  explosionGasFlameCrouchMultiplier: 0.8,
  autoStartLobbySeconds: 120,

  /** Max center-to-center distance a melee swing reaches (Dev4-confirmed: ~40px beyond the two players' hitboxes). */
  meleeRangePx: 64,
  /** Seconds between melee swings (Dev4-confirmed). */
  meleeCooldownSeconds: 0.6,
  /** How close in time two players' melee swings at each other must land to count as a clash (Dev4-confirmed). */
  meleeClashWindowSeconds: 0.3,

  /** Fixed grenade throw velocity along the aim direction (Dev4-confirmed: no variable-strength throw). */
  grenadeThrowSpeedPxPerSec: 800,
  /** Seconds between grenade throws — not specified by the flow; a modest anti-spam guard. */
  grenadeThrowCooldownSeconds: 0.5,
  /** Bounce restitution (0-1) when a thrown grenade hits a wall or floor. */
  grenadeBounceDamping: 0.5,
  /** Below this speed (px/sec) after a bounce, a grenade is considered landed/resting. */
  grenadeLandedSpeedPxPerSec: 20,
} as const;
