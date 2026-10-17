import { describe, expect, it } from 'vitest';
import type { CollisionMap } from './map.js';
import { raySegmentHitsAabb, raycastWallDistance } from './raycast.js';

const TILE_SIZE = 32;

function buildMap(rows: string[]): CollisionMap {
  return {
    tileSize: TILE_SIZE,
    widthInTiles: rows[0]!.length,
    heightInTiles: rows.length,
    isSolidTile(tileX, tileY) {
      return rows[tileY]?.[tileX] === '#';
    },
  };
}

describe('raycastWallDistance', () => {
  it('travels the full maxDistance when nothing is in the way', () => {
    const map = buildMap(['....', '....', '....', '....']);
    const distance = raycastWallDistance(map, 16, 16, 0, 1000);
    expect(distance).toBe(1000);
  });

  it('stops at the first solid tile along the ray', () => {
    const map = buildMap(['....#', '.....', '.....', '.....', '.....']);
    // Fire straight right (angle 0) from the middle of tile (0,0) toward the wall at tile x=4.
    const distance = raycastWallDistance(map, 16, 16, 0, 1000);
    expect(distance).toBeLessThan(1000);
    expect(distance).toBeGreaterThan(4 * TILE_SIZE - TILE_SIZE);
    expect(distance).toBeLessThanOrEqual(4 * TILE_SIZE);
  });
});

describe('raySegmentHitsAabb', () => {
  it('hits a box directly ahead on the ray', () => {
    const result = raySegmentHitsAabb(0, 0, 0, 1000, 100, 0, 12, 24);
    expect(result.hit).toBe(true);
    expect(result.distance).toBeCloseTo(88, 0);
  });

  it('misses a box off the ray line', () => {
    const result = raySegmentHitsAabb(0, 0, 0, 1000, 100, 200, 12, 24);
    expect(result.hit).toBe(false);
  });

  it('misses a box beyond maxDistance', () => {
    const result = raySegmentHitsAabb(0, 0, 0, 50, 100, 0, 12, 24);
    expect(result.hit).toBe(false);
  });

  it('misses a box behind the ray origin', () => {
    const result = raySegmentHitsAabb(0, 0, 0, 1000, -100, 0, 12, 24);
    expect(result.hit).toBe(false);
  });
});
