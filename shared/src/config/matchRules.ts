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
} as const;
