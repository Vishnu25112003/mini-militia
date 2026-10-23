import { MAP_RULES } from '../config/map';
import { MOVEMENT } from '../config/movement';
import { bodyOverlapsSolid } from '../physics/collision';
import type { LoadedMap, Vec2 } from './loadMap';

// Map validation (Phase 02). Pure, so the build script, the tests and the server can all run it.

export interface MapReport {
  ok: boolean;
  errors: string[];
  stats: {
    spawnPoints: number;
    pickupSpots: number;
    /** Smallest distance in px between any spawn point and any pickup spot. */
    minSpawnPickupDistancePx: number;
    /** Positions (8 px lattice) where a standing soldier fits, and how many of them can be reached. */
    freePositions: number;
    reachablePositions: number;
  };
}

const LATTICE = 8;

const tileAt = (map: LoadedMap, p: Vec2) => ({
  tx: Math.floor(p.x / map.tileSize),
  ty: Math.floor(p.y / map.tileSize),
});

export function validateMap(map: LoadedMap): MapReport {
  const errors: string[] = [];
  const R = MAP_RULES;

  // --- size and counts
  if (map.tileSize !== R.tileSize) errors.push(`tile size is ${map.tileSize}, expected ${R.tileSize}`);
  if (map.widthTiles !== R.widthTiles || map.heightTiles !== R.heightTiles) {
    errors.push(
      `map is ${map.widthTiles}x${map.heightTiles} tiles, expected ${R.widthTiles}x${R.heightTiles}`,
    );
  }
  if (map.spawnPoints.length !== R.spawnPointCount) {
    errors.push(`${map.spawnPoints.length} spawn points, expected exactly ${R.spawnPointCount}`);
  }
  if (map.pickupSpots.length !== R.pickupSpotCount) {
    errors.push(`${map.pickupSpots.length} pickup spots, expected exactly ${R.pickupSpotCount}`);
  }

  // --- nothing inside a solid tile
  const inSolid = (label: string, pts: Vec2[]) =>
    pts.forEach((p, i) => {
      const { tx, ty } = tileAt(map, p);
      if (map.collision.isSolid(tx, ty))
        errors.push(`${label} ${i + 1} at (${p.x}, ${p.y}) is inside a solid tile`);
    });
  inSolid('spawn point', map.spawnPoints);
  inSolid('pickup spot', map.pickupSpots);

  // --- every spawn point at least 5 tiles from every pickup spot
  let minDist = Infinity;
  map.spawnPoints.forEach((s, si) =>
    map.pickupSpots.forEach((p, pi) => {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      minDist = Math.min(minDist, d);
      if (d < R.minSpawnPickupDistancePx) {
        errors.push(
          `spawn point ${si + 1} is only ${d.toFixed(0)} px from pickup spot ${pi + 1} (minimum ${R.minSpawnPickupDistancePx})`,
        );
      }
    }),
  );

  // --- closed boundary: no open tile on the outer ring, so nobody can fly out
  let openOnEdge = 0;
  for (let x = 0; x < map.widthTiles; x++) {
    if (!map.collision.isSolid(x, 0)) openOnEdge++;
    if (!map.collision.isSolid(x, map.heightTiles - 1)) openOnEdge++;
  }
  for (let y = 0; y < map.heightTiles; y++) {
    if (!map.collision.isSolid(0, y)) openOnEdge++;
    if (!map.collision.isSolid(map.widthTiles - 1, y)) openOnEdge++;
  }
  if (openOnEdge > 0)
    errors.push(`the map boundary is not closed: ${openOnEdge} open tiles on the outer edge`);

  // --- reachability with walking + jetpack: a standing soldier can get from any spawn to everywhere
  const { freePositions, reachablePositions, unreachableTargets } = reachability(map);
  const unreached = freePositions - reachablePositions;
  if (unreached > 0)
    errors.push(`${unreached} positions where a soldier fits cannot be reached (sealed-off area)`);
  for (const t of unreachableTargets) errors.push(t);

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      spawnPoints: map.spawnPoints.length,
      pickupSpots: map.pickupSpots.length,
      minSpawnPickupDistancePx: minDist === Infinity ? 0 : minDist,
      freePositions,
      reachablePositions,
    },
  };
}

function reachability(map: LoadedMap) {
  const cols = Math.floor(map.widthPx / LATTICE) + 1;
  const rows = Math.floor(map.heightPx / LATTICE) + 1;
  const W = MOVEMENT.width;
  const H = MOVEMENT.standHeight;
  const free = new Uint8Array(cols * rows);
  let freePositions = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * LATTICE;
      const y = r * LATTICE; // feet
      if (y - H < 0 || x - W / 2 < 0) continue;
      if (!bodyOverlapsSolid(map.collision, x, y, W, H)) {
        free[r * cols + c] = 1;
        freePositions++;
      }
    }
  }
  const cell = (p: Vec2) => ({
    c: Math.max(0, Math.min(cols - 1, Math.round(p.x / LATTICE))),
    r: Math.max(0, Math.min(rows - 1, Math.round(p.y / LATTICE))),
  });

  const unreachableTargets: string[] = [];
  const start = map.spawnPoints[0];
  if (!start) return { freePositions, reachablePositions: 0, unreachableTargets };
  const s = cell(start);
  if (!free[s.r * cols + s.c]) {
    return {
      freePositions,
      reachablePositions: 0,
      unreachableTargets: ['the first spawn point is not on a free position'],
    };
  }

  const seen = new Uint8Array(cols * rows);
  const queue: number[] = [s.r * cols + s.c];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const c = i % cols;
    const r = (i / cols) | 0;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (free[j] && !seen[j]) {
        seen[j] = 1;
        queue.push(j);
      }
    }
  }

  const check = (label: string, pts: Vec2[]) =>
    pts.forEach((p, i) => {
      const k = cell(p);
      if (!seen[k.r * cols + k.c])
        unreachableTargets.push(
          `${label} ${i + 1} at (${p.x}, ${p.y}) cannot be reached from the first spawn point`,
        );
    });
  check('spawn point', map.spawnPoints);
  check('pickup spot', map.pickupSpots);

  return { freePositions, reachablePositions: queue.length, unreachableTargets };
}
