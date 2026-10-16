import { describe, expect, it } from 'vitest';
import type { CollisionMap } from './map.js';
import { projectileHitsPlayer, projectileHitsWall, stepProjectile, type Projectile } from './projectile.js';

const TILE_SIZE = 32;

function buildMap(rows: string[]): CollisionMap {
  return {
    tileSize: TILE_SIZE,
    widthInTiles: rows[0]!.length,
    heightInTiles: rows.length,
    isSolidTile: (x, y) => rows[y]?.[x] === '#',
  };
}

function makeProjectile(overrides: Partial<Projectile> = {}): Projectile {
  return {
    id: 'p1',
    ownerId: 'shooter',
    weapon: 'SMAW',
    x: 0,
    y: 0,
    angle: 0,
    speedPxPerSec: 900,
    travelledPx: 0,
    maxRangePx: 1900,
    ...overrides,
  };
}

describe('stepProjectile', () => {
  it('moves along its angle at speedPxPerSec * dt and tracks distance travelled', () => {
    const next = stepProjectile(makeProjectile(), 0.1);
    expect(next.x).toBeCloseTo(90);
    expect(next.y).toBeCloseTo(0);
    expect(next.travelledPx).toBeCloseTo(90);
  });

  it('moves diagonally correctly', () => {
    const next = stepProjectile(makeProjectile({ angle: Math.PI / 2 }), 0.1);
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(90);
  });
});

describe('projectileHitsWall', () => {
  it('detects a solid tile at the projectile position', () => {
    const map = buildMap(['....#', '.....']);
    expect(projectileHitsWall(map, makeProjectile({ x: 4 * TILE_SIZE + 5, y: 5 }))).toBe(true);
  });

  it('is false over open ground', () => {
    const map = buildMap(['.....', '.....']);
    expect(projectileHitsWall(map, makeProjectile({ x: 16, y: 16 }))).toBe(false);
  });

  it('is false (not solid) outside the map bounds', () => {
    const map = buildMap(['..', '..']);
    expect(projectileHitsWall(map, makeProjectile({ x: -100, y: -100 }))).toBe(false);
  });
});

describe('projectileHitsPlayer', () => {
  it('detects a player whose hitbox the projectile center has entered', () => {
    expect(projectileHitsPlayer(makeProjectile({ x: 100, y: 100 }), 105, 110)).toBe(true);
  });

  it('misses a player far from the projectile', () => {
    expect(projectileHitsPlayer(makeProjectile({ x: 0, y: 0 }), 500, 500)).toBe(false);
  });
});
