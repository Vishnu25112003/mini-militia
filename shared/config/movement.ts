import { TICK_DT } from './matchRules';

// Movement and jetpack numbers.
// PLACEHOLDER values — "tuned during build" (Game Flow, Section 14). Phase 03 tunes them by feel
// (the sandbox has a live tuning panel that prints the final values to paste in here).
// Units: pixels and seconds. Tiles are 32 px. y grows downward.

export interface MovementConfig {
  /** Fixed physics timestep (1/30 s, same as the server tick). */
  dt: number;

  // body (the feet position is the reference point)
  width: number;
  standHeight: number;
  crouchHeight: number;

  // walking
  walkSpeed: number;
  crouchSpeedFactor: number;
  groundAccel: number;
  /** Horizontal speed cap and acceleration while airborne. */
  airSpeed: number;
  airAccel: number;

  // gravity at host setting 100 (px/s^2) and terminal fall speed
  gravity: number;
  maxFallSpeed: number;
  /** Vertical damping per second at gravity 0 so a player "floats" and settles instead of drifting forever. */
  zeroGravityDrag: number;

  // jetpack
  jetThrust: number;
  maxRiseSpeed: number;
  fuelCapacity: number;
  /** Fuel use per second as a fraction of capacity at boost 0; scales linearly down to 0 at boost 100. */
  drainFractionAtBoost0: number;
  /** Refill per second as a fraction of capacity when not flying. */
  refillFractionGround: number;
  refillFractionAir: number;
}

export const MOVEMENT: MovementConfig = {
  dt: TICK_DT,

  width: 24,
  standHeight: 48,
  crouchHeight: 30,

  walkSpeed: 200,
  crouchSpeedFactor: 0.45,
  groundAccel: 2400,
  airSpeed: 200,
  airAccel: 1100,

  gravity: 1400,
  maxFallSpeed: 900,
  zeroGravityDrag: 1.6,

  jetThrust: 2600,
  maxRiseSpeed: 380,
  fuelCapacity: 100,
  drainFractionAtBoost0: 1.0,
  refillFractionGround: 0.5,
  refillFractionAir: 0.15,
};

/** Largest distance (px) the collision sweep moves in one go; keeps fast bodies from tunnelling. */
export const SWEEP_STEP_PX = 8;
