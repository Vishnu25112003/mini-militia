import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
