import type { GrenadeId } from '../config/grenades.js';
import { MATCH_RULES } from '../config/matchRules.js';
import type { CollisionMap } from './map.js';

export interface GrenadeProjectile {
  id: string;
  ownerId: string;
  grenade: GrenadeId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fragnade/Proxynade: seconds until fuse/arm fires; counts down regardless of bounces. */
  fuseRemainingSeconds: number;
  /** True once speed has settled below `grenadeLandedSpeedPxPerSec` after a bounce — Gasnade explodes here. */
  landed: boolean;
}

function isSolidAtPoint(map: CollisionMap, x: number, y: number): boolean {
  const tileX = Math.floor(x / map.tileSize);
  const tileY = Math.floor(y / map.tileSize);
  if (tileX < 0 || tileY < 0 || tileX >= map.widthInTiles || tileY >= map.heightInTiles) return false;
  return map.isSolidTile(tileX, tileY);
}

/**
 * Arcade grenade flight — gravity pulls it down, it bounces (with damping) off
 * walls and floors, and once its speed drops below the landed threshold it
 * stops moving. Treated as a point (no hitbox) for collision, unlike players
 * and bullets — simple is enough for a thrown, lightweight object.
 */
export function stepGrenade(
  grenade: GrenadeProjectile,
  map: CollisionMap,
  gravityPxPerSecSq: number,
  dt: number,
): GrenadeProjectile {
  const fuseRemainingSeconds = Math.max(0, grenade.fuseRemainingSeconds - dt);

  if (grenade.landed) {
    return { ...grenade, fuseRemainingSeconds };
  }

  let vy = grenade.vy + gravityPxPerSecSq * dt;
  let vx = grenade.vx;

  const triedX = grenade.x + vx * dt;
  const x = isSolidAtPoint(map, triedX, grenade.y) ? grenade.x : triedX;
  if (x === grenade.x) vx = -vx * MATCH_RULES.grenadeBounceDamping;

  const triedY = grenade.y + vy * dt;
  const blockedByFloor = isSolidAtPoint(map, x, triedY);
  const y = blockedByFloor ? grenade.y : triedY;
  if (blockedByFloor) vy = -vy * MATCH_RULES.grenadeBounceDamping;

  // "Landed" means resting on the floor — only ever set right after a floor bounce leaves it too
  // slow to keep bouncing, not just because it's briefly slow mid-arc (e.g. at the apex).
  const landed = blockedByFloor && Math.hypot(vx, vy) < MATCH_RULES.grenadeLandedSpeedPxPerSec;

  return { ...grenade, x, y, vx, vy, fuseRemainingSeconds, landed };
}

/** Linear falloff from full damage at the center to 0 at the edge of the radius — the flow says "less toward the edge" without an exact curve. */
export function grenadeDamageAtDistance(
  centerDamage: number,
  distancePx: number,
  radiusPx: number,
): number {
  if (distancePx > radiusPx) return 0;
  const falloff = 1 - distancePx / radiusPx;
  return centerDamage * falloff;
}
