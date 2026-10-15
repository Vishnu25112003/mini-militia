/**
 * Placeholder movement numbers — tune during Phase 03 (Local Movement Sandbox)
 * once the game is actually playable. Units are pixels and seconds, matching
 * the map's 32px tiles.
 */
export const MOVEMENT = {
  /** Server tick rate; physics `step` always advances by this fixed dt. */
  tickRate: 30,
  walkSpeedPxPerSec: 180,
  /** Downward acceleration at gravity setting = 100 (normal gravity). */
  gravityPxPerSecSqAtMax: 900,
  /** Upward acceleration applied while the jetpack is firing. */
  jetpackThrustPxPerSecSq: 1400,
  /** Terminal fall speed, independent of the gravity setting. */
  terminalVelocityPxPerSec: 1200,
  fuelCapacity: 100,
  /** Fuel drain per second at boost setting = 0 (fastest drain). */
  maxFuelDrainPerSec: 60,
  /** Fuel refill per second while not flying, regardless of boost setting. */
  fuelRefillPerSec: 35,
} as const;

/** Gravity setting (0-100) → downward acceleration, linear. 0 = floating. */
export function gravityForSetting(gravitySetting: number): number {
  return (gravitySetting / 100) * MOVEMENT.gravityPxPerSecSqAtMax;
}

/** Boost setting (0-100) → fuel drain per second while flying. 100 = no drain. */
export function fuelDrainRateForSetting(boostSetting: number): number {
  return ((100 - boostSetting) / 100) * MOVEMENT.maxFuelDrainPerSec;
}
