import { MOVEMENT, type MovementConfig } from '../config/movement';
import type { HostSettings, PlayerInput, PlayerState } from '../types';
import { bodyOverlapsSolid, isStandingOnSolid, sweepX, sweepY, type CollisionMap } from './collision';

/** The only host settings physics cares about. */
export type PhysicsSettings = Pick<HostSettings, 'gravity' | 'boost'>;

const approach = (v: number, target: number, maxDelta: number) =>
  v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);

/**
 * Advance one player by one fixed timestep (1/30 s).
 *
 * PURE: the result depends only on the arguments — no randomness, no clock, nothing mutated — so the
 * server and the browser compute exactly the same thing (client-side prediction relies on this).
 * Only movement fields change; combat, scoring and inventory are handled elsewhere.
 *
 * `movement` defaults to the shared config; only the sandbox's live-tuning panel passes its own copy.
 */
export function step(
  state: PlayerState,
  input: PlayerInput,
  map: CollisionMap,
  settings: PhysicsSettings,
  movement: MovementConfig = MOVEMENT,
): PlayerState {
  if (!state.alive) return state;

  const M = movement;
  const dt = M.dt;
  const moveX = Math.max(-1, Math.min(1, Number.isFinite(input.moveX) ? input.moveX : 0));

  // --- crouch: only on the ground; can't stand up under a low ceiling
  let crouching = state.onGround && input.crouch;
  if (!crouching && state.crouching && bodyOverlapsSolid(map, state.x, state.y, M.width, M.standHeight)) {
    crouching = state.onGround;
  }
  const height = crouching ? M.crouchHeight : M.standHeight;

  // --- horizontal velocity
  const maxSpeed = (state.onGround ? M.walkSpeed : M.airSpeed) * (crouching ? M.crouchSpeedFactor : 1);
  const accel = state.onGround ? M.groundAccel : M.airAccel;
  let vx = approach(state.vx, moveX * maxSpeed, accel * dt);

  // --- vertical velocity: jetpack + gravity
  const gravityScale = Math.max(0, Math.min(100, settings.gravity)) / 100;
  const boost = Math.max(0, Math.min(100, settings.boost));
  let vy = state.vy;
  let fuel = state.fuel;
  const tryingToFly = input.fly && !crouching;
  const flying = tryingToFly && fuel > 0;

  if (flying) {
    vy -= M.jetThrust * dt;
    if (vy < -M.maxRiseSpeed) vy = -M.maxRiseSpeed;
    if (boost < 100) {
      const drain = M.fuelCapacity * M.drainFractionAtBoost0 * ((100 - boost) / 100);
      fuel = Math.max(0, fuel - drain * dt);
    }
  } else if (!tryingToFly) {
    // the tank only recharges once the fly button is released; holding it with an empty tank does nothing
    // (otherwise a trickle of refill would flicker the thrust on every other tick)
    const refill = M.fuelCapacity * (state.onGround ? M.refillFractionGround : M.refillFractionAir);
    fuel = Math.min(M.fuelCapacity, fuel + refill * dt);
  }
  if (boost >= 100) fuel = M.fuelCapacity; // unlimited: the bar stays full

  vy += M.gravity * gravityScale * dt;
  if (gravityScale < 1) vy *= Math.max(0, 1 - M.zeroGravityDrag * (1 - gravityScale) * dt);
  if (vy > M.maxFallSpeed) vy = M.maxFallSpeed;

  // --- move, one axis at a time, stopping at solid tiles
  let x = state.x;
  let y = state.y;
  const mx = sweepX(map, x, y, M.width, height, vx * dt);
  x = mx.x;
  if (mx.hit) vx = 0;
  const my = sweepY(map, x, y, M.width, height, vy * dt);
  y = my.y;
  if (my.hit) vy = 0;

  const onGround = isStandingOnSolid(map, x, y, M.width, height) && vy >= 0;

  return {
    ...state,
    x,
    y,
    vx,
    vy,
    facing: Math.cos(input.aimAngle) >= 0 ? 1 : -1,
    crouching,
    onGround,
    flying,
    fuel,
    lastInputSeq: input.seq,
  };
}
