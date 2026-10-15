import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CollisionMap } from '../src/physics/map.js';
import { isPositionClearForPlayer } from '../src/physics/step.js';
import { loadMap, type MapPoint, type TiledMapJson } from '../src/maps/loadMap.js';

export const EXPECTED_SPAWN_COUNT = 16;
export const EXPECTED_PICKUP_COUNT = 14;
export const MIN_SPAWN_TO_PICKUP_PX = 5 * 32;

function distance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function tileAt(map: CollisionMap, point: MapPoint): { x: number; y: number } {
  return { x: Math.floor(point.x / map.tileSize), y: Math.floor(point.y / map.tileSize) };
}

export function validateCounts(spawnPoints: MapPoint[], pickupSpots: MapPoint[]): string[] {
  const errors: string[] = [];
  if (spawnPoints.length !== EXPECTED_SPAWN_COUNT) {
    errors.push(`Expected ${EXPECTED_SPAWN_COUNT} spawn points, found ${spawnPoints.length}`);
  }
  if (pickupSpots.length !== EXPECTED_PICKUP_COUNT) {
    errors.push(`Expected ${EXPECTED_PICKUP_COUNT} pickup spots, found ${pickupSpots.length}`);
  }
  return errors;
}

export function validateSpawnPickupSpacing(
  spawnPoints: MapPoint[],
  pickupSpots: MapPoint[],
): string[] {
  const errors: string[] = [];
  for (const spawn of spawnPoints) {
    for (const pickup of pickupSpots) {
      const d = distance(spawn, pickup);
      if (d < MIN_SPAWN_TO_PICKUP_PX) {
        errors.push(
          `${spawn.id} is only ${d.toFixed(1)}px from ${pickup.id} (needs ${MIN_SPAWN_TO_PICKUP_PX}px)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Checks the player's full hitbox at each point, not just the tile under its
 * center — the hitbox (48px tall) spans more than one tile, so a point whose
 * own tile is open can still overlap a wall right above or below it (found
 * for real: a spawn at the edge of a 4-tile-thick tunnel, overlapping the
 * wall one tile away).
 */
export function validateNoPointInsideSolid(map: CollisionMap, points: MapPoint[]): string[] {
  const errors: string[] = [];
  for (const point of points) {
    if (!isPositionClearForPlayer(map, point.x, point.y)) {
      const tile = tileAt(map, point);
      errors.push(
        `${point.id} at (${point.x}, ${point.y}) overlaps a solid tile near (${tile.x}, ${tile.y}) — the player hitbox doesn't fit`,
      );
    }
  }
  return errors;
}

/**
 * The only thing standing between a player and flying off the map is the
 * outermost ring of tiles being solid — physics itself treats out-of-range
 * tiles as open, not solid (see shared/src/physics/step.ts).
 */
export function validateClosedBoundary(map: CollisionMap): string[] {
  const errors: string[] = [];
  const checkTile = (x: number, y: number) => {
    if (!map.isSolidTile(x, y))
      errors.push(`Boundary tile (${x}, ${y}) is not solid — players could fly out here`);
  };

  for (let x = 0; x < map.widthInTiles; x++) {
    checkTile(x, 0);
    checkTile(x, map.heightInTiles - 1);
  }
  for (let y = 0; y < map.heightInTiles; y++) {
    checkTile(0, y);
    checkTile(map.widthInTiles - 1, y);
  }
  return errors;
}

/**
 * Flood-fills the open tiles from one known-open tile and checks every open
 * tile was reached — a jetpack can cross any open space, so one connected
 * region is exactly what "every area is reachable" requires.
 */
export function validateReachability(map: CollisionMap): string[] {
  let start: { x: number; y: number } | null = null;
  const totalOpen: { x: number; y: number }[] = [];

  for (let y = 0; y < map.heightInTiles && !start; y++) {
    for (let x = 0; x < map.widthInTiles; x++) {
      if (!map.isSolidTile(x, y)) {
        start = { x, y };
        break;
      }
    }
  }

  for (let y = 0; y < map.heightInTiles; y++) {
    for (let x = 0; x < map.widthInTiles; x++) {
      if (!map.isSolidTile(x, y)) totalOpen.push({ x, y });
    }
  }

  if (!start) return ['The map has no open tiles at all'];

  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [start];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx!;
      const ny = y + dy!;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= map.widthInTiles || ny >= map.heightInTiles) continue;
      if (visited.has(key) || map.isSolidTile(nx, ny)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  const unreached = totalOpen.length - visited.size;
  if (unreached > 0) {
    return [
      `${unreached} open tile(s) are disconnected from the main open area — not reachable by flying`,
    ];
  }
  return [];
}

export interface MapValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLoadedMap(
  map: CollisionMap,
  spawnPoints: MapPoint[],
  pickupSpots: MapPoint[],
): MapValidationResult {
  const errors = [
    ...validateCounts(spawnPoints, pickupSpots),
    ...validateSpawnPickupSpacing(spawnPoints, pickupSpots),
    ...validateNoPointInsideSolid(map, [...spawnPoints, ...pickupSpots]),
    ...validateClosedBoundary(map),
    ...validateReachability(map),
  ];
  return { valid: errors.length === 0, errors };
}

// --- CLI entry point: `npm run validate-map` (also wired as a prebuild step) ---

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const here = dirname(fileURLToPath(import.meta.url));
  const mapJson = JSON.parse(readFileSync(join(here, 'catacombs.json'), 'utf-8')) as TiledMapJson;
  const { collisionMap, spawnPoints, pickupSpots } = loadMap(mapJson);
  const result = validateLoadedMap(collisionMap, spawnPoints, pickupSpots);

  if (result.valid) {
    console.log(
      `catacombs.json is valid: ${spawnPoints.length} spawns, ${pickupSpots.length} pickups.`,
    );
  } else {
    console.error('catacombs.json failed validation:');
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
}
