import { SWEEP_STEP_PX } from '../config/movement';

/** What physics needs to know about the map: a grid of solid / empty tiles. */
export interface CollisionMap {
  tileSize: number;
  widthTiles: number;
  heightTiles: number;
  /** True when the tile is solid. Tiles outside the map count as solid, so nobody can leave it. */
  isSolid(tx: number, ty: number): boolean;
}

/** Gap kept between a body and the surface it stopped at, so it never ends up overlapping it. */
export const EPS = 0.001;
/** How far below the feet we look to decide "standing on something". Must be larger than EPS. */
const GROUND_PROBE = 0.01;

/** Does the box [left,right) x [top,bottom) overlap any solid tile? */
export function boxOverlapsSolid(
  map: CollisionMap,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  const t = map.tileSize;
  const tx0 = Math.floor(left / t);
  const tx1 = Math.ceil(right / t) - 1;
  const ty0 = Math.floor(top / t);
  const ty1 = Math.ceil(bottom / t) - 1;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (map.isSolid(tx, ty)) return true;
    }
  }
  return false;
}

/** Hitbox helper: x is the centre, y is the feet (bottom). */
export function bodyOverlapsSolid(map: CollisionMap, x: number, y: number, w: number, h: number): boolean {
  return boxOverlapsSolid(map, x - w / 2, y - h, x + w / 2, y);
}

export function isStandingOnSolid(map: CollisionMap, x: number, y: number, w: number, h: number): boolean {
  return bodyOverlapsSolid(map, x, y + GROUND_PROBE, w, h);
}

/**
 * Move horizontally by dx, stopping at the first solid tile. The move is cut into steps of at most
 * SWEEP_STEP_PX so a fast body can never skip over a wall.
 */
export function sweepX(
  map: CollisionMap,
  x: number,
  y: number,
  w: number,
  h: number,
  dx: number,
): { x: number; hit: boolean } {
  if (dx === 0) return { x, hit: false };
  const n = Math.max(1, Math.ceil(Math.abs(dx) / SWEEP_STEP_PX));
  const sx = dx / n;
  const t = map.tileSize;
  for (let i = 0; i < n; i++) {
    const nx = x + sx;
    if (bodyOverlapsSolid(map, nx, y, w, h)) {
      if (sx > 0) {
        const col = Math.floor((nx + w / 2) / t);
        return { x: col * t - w / 2 - EPS, hit: true };
      }
      const col = Math.floor((nx - w / 2) / t);
      return { x: (col + 1) * t + w / 2 + EPS, hit: true };
    }
    x = nx;
  }
  return { x, hit: false };
}

/** Move vertically by dy (y is the feet position; positive dy moves down). Same stepping as sweepX. */
export function sweepY(
  map: CollisionMap,
  x: number,
  y: number,
  w: number,
  h: number,
  dy: number,
): { y: number; hit: boolean } {
  if (dy === 0) return { y, hit: false };
  const n = Math.max(1, Math.ceil(Math.abs(dy) / SWEEP_STEP_PX));
  const sy = dy / n;
  const t = map.tileSize;
  for (let i = 0; i < n; i++) {
    const ny = y + sy;
    if (bodyOverlapsSolid(map, x, ny, w, h)) {
      if (sy > 0) {
        const row = Math.floor(ny / t);
        return { y: row * t - EPS, hit: true };
      }
      const row = Math.floor((ny - h) / t);
      return { y: (row + 1) * t + h + EPS, hit: true };
    }
    y = ny;
  }
  return { y, hit: false };
}
