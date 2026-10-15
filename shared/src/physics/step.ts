import { MOVEMENT, gravityForSetting, fuelDrainRateForSetting } from '../config/movement.js';
import type { Facing, PlayerInput, PlayerState, Vector2 } from '../types/player.js';
import type { CollisionMap } from './map.js';

export interface PhysicsSettings {
  /** 0-100; see config/movement.ts gravityForSetting. */
  gravity: number;
  /** 0-100; see config/movement.ts fuelDrainRateForSetting. */
  boost: number;
}

const DT = 1 / MOVEMENT.tickRate;

/** Placeholder hitbox — tune alongside the real art in Phase 03/15. Position is the box's center. */
export const PLAYER_HALF_WIDTH = 12;
export const PLAYER_HALF_HEIGHT = 24;

/**
 * Outside the tile grid is open, not solid — the map's own boundary walls
 * (real tiles, authored in Phase 02) are what actually bound the arena. This
 * just guards against querying `isSolidTile` with an out-of-range index.
 */
function isSolidAt(map: CollisionMap, tileX: number, tileY: number): boolean {
  if (tileX < 0 || tileY < 0 || tileX >= map.widthInTiles || tileY >= map.heightInTiles) {
    return false;
  }
  return map.isSolidTile(tileX, tileY);
}

/**
 * True if a player's hitbox, centered at this pixel position, fits without
 * overlapping any solid tile. Exported so map generation/validation can
 * place spawn and pickup points that are actually clear — the player's
 * hitbox (48px tall) spans more than one tile, so checking only the single
 * tile under the point isn't enough near a thin corridor's edge.
 */
export function isPositionClearForPlayer(
  map: CollisionMap,
  centerX: number,
  centerY: number,
): boolean {
  return !aabbOverlapsSolid(map, centerX, centerY);
}

function aabbOverlapsSolid(map: CollisionMap, centerX: number, centerY: number): boolean {
  const left = centerX - PLAYER_HALF_WIDTH;
  const right = centerX + PLAYER_HALF_WIDTH;
  const top = centerY - PLAYER_HALF_HEIGHT;
  const bottom = centerY + PLAYER_HALF_HEIGHT;

  const minTileX = Math.floor(left / map.tileSize);
  const maxTileX = Math.floor((right - 1e-6) / map.tileSize);
  const minTileY = Math.floor(top / map.tileSize);
  const maxTileY = Math.floor((bottom - 1e-6) / map.tileSize);

  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (isSolidAt(map, tx, ty)) return true;
    }
  }
  return false;
}

interface MoveResult {
  position: Vector2;
  velocityY: number;
  onGround: boolean;
}

/**
 * Axis-separated movement, sub-stepped so a tick's displacement never exceeds
 * half a tile — otherwise a fast-falling player could tunnel through a
 * single-tile-thick floor in one step.
 */
function moveWithCollision(position: Vector2, velocity: Vector2, map: CollisionMap): MoveResult {
  const deltaX = velocity.x * DT;
  const deltaY = velocity.y * DT;
  const maxDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  const steps = Math.min(8, Math.max(1, Math.ceil(maxDelta / (map.tileSize / 2))));

  let x = position.x;
  let y = position.y;
  let velocityY = velocity.y;
  let onGround = false;

  for (let i = 0; i < steps; i++) {
    const stepX = deltaX / steps;
    const stepY = deltaY / steps;

    const triedX = x + stepX;
    if (!aabbOverlapsSolid(map, triedX, y)) {
      x = triedX;
    }
    // Otherwise: blocked by a wall. Horizontal velocity is re-derived from
    // input every tick, so there's nothing to zero out here.

    const triedY = y + stepY;
    if (!aabbOverlapsSolid(map, x, triedY)) {
      y = triedY;
      onGround = false;
    } else {
      if (stepY > 0) onGround = true;
      velocityY = 0;
    }
  }

  return { position: { x, y }, velocityY, onGround };
}

/**
 * Pure physics tick: `step(state, input, map, settings) → newState`.
 * No randomness, no clocks — the server and the client's own-movement
 * prediction must get identical results from identical inputs.
 */
export function step(
  state: PlayerState,
  input: PlayerInput,
  map: CollisionMap,
  settings: PhysicsSettings,
): PlayerState {
  const crouching = state.onGround && input.crouch;
  // Facing follows aim, not movement: the crouch shield and melee direction
  // (logic/damage.ts, logic/melee.ts) are about which way the player is
  // looking/shooting, same as the real game's aim-driven character turning.
  const facing: Facing = Math.cos(input.aimAngle) >= 0 ? 'right' : 'left';

  const vx = crouching ? 0 : input.moveX * MOVEMENT.walkSpeedPxPerSec;
  const flying = input.fly && state.fuel > 0 && !crouching;

  let vy = state.velocity.y;
  if (flying) {
    vy -= MOVEMENT.jetpackThrustPxPerSecSq * DT;
  } else {
    vy += gravityForSetting(settings.gravity) * DT;
  }
  vy = Math.max(
    -MOVEMENT.terminalVelocityPxPerSec,
    Math.min(MOVEMENT.terminalVelocityPxPerSec, vy),
  );

  const fuel = flying
    ? Math.max(0, state.fuel - fuelDrainRateForSetting(settings.boost) * DT)
    : Math.min(MOVEMENT.fuelCapacity, state.fuel + MOVEMENT.fuelRefillPerSec * DT);

  const moved = moveWithCollision(state.position, { x: vx, y: vy }, map);

  return {
    ...state,
    position: moved.position,
    velocity: { x: vx, y: moved.velocityY },
    facing,
    crouching,
    onGround: moved.onGround,
    fuel,
  };
}
