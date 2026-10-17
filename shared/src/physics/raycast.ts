import type { CollisionMap } from './map.js';

/** Sampling step for marching a hitscan ray through the collision map, in pixels. */
const WALL_MARCH_STEP_PX = 4;

/**
 * How far a ray can travel before it's stopped by a solid tile, up to
 * `maxDistance`. No per-weapon falloff is modeled (the flow doesn't specify
 * one) — a hit anywhere along a clear line of sight deals full damage.
 */
export function raycastWallDistance(
  map: CollisionMap,
  originX: number,
  originY: number,
  angle: number,
  maxDistance: number,
): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const steps = Math.ceil(maxDistance / WALL_MARCH_STEP_PX);

  for (let i = 1; i <= steps; i++) {
    const distance = Math.min(maxDistance, i * WALL_MARCH_STEP_PX);
    const x = originX + dx * distance;
    const y = originY + dy * distance;
    const tileX = Math.floor(x / map.tileSize);
    const tileY = Math.floor(y / map.tileSize);
    if (tileX < 0 || tileY < 0 || tileX >= map.widthInTiles || tileY >= map.heightInTiles) continue;
    if (map.isSolidTile(tileX, tileY)) return distance;
  }
  return maxDistance;
}

export interface RaySegmentHit {
  hit: boolean;
  /** Distance from the ray's origin to the first intersection, if `hit`. */
  distance: number;
}

const NO_HIT: RaySegmentHit = { hit: false, distance: Infinity };

/**
 * Slab-method ray/AABB intersection: does the ray from `(originX, originY)`
 * at `angle`, limited to `maxDistance`, pass through the axis-aligned box
 * centered at `(boxCenterX, boxCenterY)`?
 */
export function raySegmentHitsAabb(
  originX: number,
  originY: number,
  angle: number,
  maxDistance: number,
  boxCenterX: number,
  boxCenterY: number,
  halfWidth: number,
  halfHeight: number,
): RaySegmentHit {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const minX = boxCenterX - halfWidth;
  const maxX = boxCenterX + halfWidth;
  const minY = boxCenterY - halfHeight;
  const maxY = boxCenterY + halfHeight;

  let tmin = 0;
  let tmax = maxDistance;

  if (Math.abs(dx) < 1e-9) {
    if (originX < minX || originX > maxX) return NO_HIT;
  } else {
    let t1 = (minX - originX) / dx;
    let t2 = (maxX - originX) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return NO_HIT;
  }

  if (Math.abs(dy) < 1e-9) {
    if (originY < minY || originY > maxY) return NO_HIT;
  } else {
    let t1 = (minY - originY) / dy;
    let t2 = (maxY - originY) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return NO_HIT;
  }

  if (tmax < 0 || tmin > maxDistance) return NO_HIT;
  return { hit: true, distance: Math.max(tmin, 0) };
}
