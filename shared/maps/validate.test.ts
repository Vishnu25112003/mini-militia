import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CollisionMap } from '../src/physics/map.js';
import { loadMap, type TiledMapJson } from '../src/maps/loadMap.js';
import {
  EXPECTED_PICKUP_COUNT,
  EXPECTED_SPAWN_COUNT,
  validateClosedBoundary,
  validateCounts,
  validateLoadedMap,
  validateNoPointInsideSolid,
  validateReachability,
  validateSpawnPickupSpacing,
} from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const mapJson = JSON.parse(readFileSync(join(here, 'catacombs.json'), 'utf-8')) as TiledMapJson;
const { collisionMap, spawnPoints, pickupSpots } = loadMap(mapJson);

describe('catacombs.json', () => {
  it('has exactly 16 spawn points and 14 pickup spots', () => {
    expect(spawnPoints).toHaveLength(EXPECTED_SPAWN_COUNT);
    expect(pickupSpots).toHaveLength(EXPECTED_PICKUP_COUNT);
    expect(validateCounts(spawnPoints, pickupSpots)).toEqual([]);
  });

  it('keeps every spawn point at least 160px from every pickup spot', () => {
    expect(validateSpawnPickupSpacing(spawnPoints, pickupSpots)).toEqual([]);
  });

  it('never places a spawn or pickup inside a solid tile', () => {
    expect(validateNoPointInsideSolid(collisionMap, [...spawnPoints, ...pickupSpots])).toEqual([]);
  });

  it('has a fully closed boundary — no gaps for a player to fly out through', () => {
    expect(validateClosedBoundary(collisionMap)).toEqual([]);
  });

  it('keeps every open tile reachable by flying (one connected region)', () => {
    expect(validateReachability(collisionMap)).toEqual([]);
  });

  it('passes full validation end to end', () => {
    const result = validateLoadedMap(collisionMap, spawnPoints, pickupSpots);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('validateNoPointInsideSolid — hitbox, not just the center tile', () => {
  // A point's own tile can be open while the player's hitbox (48px tall —
  // more than one 32px tile) still overlaps a wall one tile away. Caught for
  // real: a spawn at the edge of the 4-tile-thick cave tunnel, where a
  // player centered there had their feet inside the tile below the tunnel.
  function buildTestMap(rows: string[]): CollisionMap {
    return {
      tileSize: 32,
      widthInTiles: rows[0]!.length,
      heightInTiles: rows.length,
      isSolidTile: (x, y) => rows[y]?.[x] === '#',
    };
  }

  it('rejects a point whose own tile is open but whose hitbox overlaps an adjacent wall', () => {
    const map = buildTestMap(['.....', '.....', '#####']);
    // Row 1 is open, but a player centered at its very bottom edge (y=63)
    // has a hitbox bottom edge (63+24=87) inside row 2 (the solid floor, y>=64).
    const point = { id: 'bad-spawn', x: 80, y: 63 };
    expect(validateNoPointInsideSolid(map, [point])).toHaveLength(1);
  });

  it('accepts a point comfortably centered in open space', () => {
    const map = buildTestMap(['.....', '.....', '#####']);
    const point = { id: 'good-spawn', x: 80, y: 32 };
    expect(validateNoPointInsideSolid(map, [point])).toEqual([]);
  });
});
