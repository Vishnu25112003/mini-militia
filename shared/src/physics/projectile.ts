import type { WeaponId } from '../config/weapons.js';
import type { CollisionMap } from './map.js';
import { PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH } from './step.js';

export interface Projectile {
  id: string;
  ownerId: string;
  weapon: WeaponId;
  x: number;
  y: number;
  angle: number;
  speedPxPerSec: number;
  travelledPx: number;
  maxRangePx: number;
}

/** Straight-line travel — no arc or gravity (a later-phase refinement). */
export function stepProjectile(projectile: Projectile, dt: number): Projectile {
  const delta = projectile.speedPxPerSec * dt;
  return {
    ...projectile,
    x: projectile.x + Math.cos(projectile.angle) * delta,
    y: projectile.y + Math.sin(projectile.angle) * delta,
    travelledPx: projectile.travelledPx + delta,
  };
}

export function projectileHitsWall(map: CollisionMap, projectile: Projectile): boolean {
  const tileX = Math.floor(projectile.x / map.tileSize);
  const tileY = Math.floor(projectile.y / map.tileSize);
  if (tileX < 0 || tileY < 0 || tileX >= map.widthInTiles || tileY >= map.heightInTiles) return false;
  return map.isSolidTile(tileX, tileY);
}

export function projectileHitsPlayer(projectile: Projectile, targetX: number, targetY: number): boolean {
  return (
    Math.abs(projectile.x - targetX) <= PLAYER_HALF_WIDTH &&
    Math.abs(projectile.y - targetY) <= PLAYER_HALF_HEIGHT
  );
}
