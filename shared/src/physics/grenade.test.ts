import { describe, expect, it } from 'vitest';
import type { CollisionMap } from './map.js';
import { grenadeDamageAtDistance, stepGrenade, type GrenadeProjectile } from './grenade.js';

function buildMap(rows: string[]): CollisionMap {
  return {
    tileSize: 32,
    widthInTiles: rows[0]!.length,
    heightInTiles: rows.length,
    isSolidTile: (x, y) => rows[y]?.[x] === '#',
  };
}

function makeGrenade(overrides: Partial<GrenadeProjectile> = {}): GrenadeProjectile {
  return {
    id: 'g1',
    ownerId: 'p1',
    grenade: 'Fragnade',
    x: 16,
    y: 16,
    vx: 100,
    vy: 0,
    fuseRemainingSeconds: 3,
    landed: false,
    ...overrides,
  };
}

describe('stepGrenade', () => {
  it('falls under gravity and moves horizontally over open ground', () => {
    const map = buildMap(['.....', '.....', '.....']);
    const next = stepGrenade(makeGrenade(), map, 1000, 0.1);
    expect(next.x).toBeCloseTo(26);
    expect(next.vy).toBeCloseTo(100);
    expect(next.fuseRemainingSeconds).toBeCloseTo(2.9);
  });

  it('bounces off a wall, reversing and damping velocity', () => {
    const map = buildMap(['.#', '..']);
    // x=16, vx=160 → tries to move to x=32, which is inside the solid tile (1, 0).
    const next = stepGrenade(makeGrenade({ x: 16, vx: 160, vy: 0 }), map, 0, 0.1);
    expect(next.x).toBe(16); // blocked this step
    expect(next.vx).toBeCloseTo(-80); // damped 0.5x and reversed
  });

  it('settles to landed once a floor bounce leaves it too slow to keep bouncing', () => {
    const map = buildMap(['..', '##']);
    // y=30, vy=30 → tries to move to y=33 (into the solid row) → bounces to vy=-15, below the landed threshold.
    const next = stepGrenade(makeGrenade({ x: 16, y: 30, vx: 0, vy: 30 }), map, 0, 0.1);
    expect(next.landed).toBe(true);
  });

  it('does not land just from being briefly slow mid-air (e.g. at the apex of its arc)', () => {
    const map = buildMap(['....', '....']); // all open — never touches a floor
    const next = stepGrenade(makeGrenade({ x: 16, y: 16, vx: 5, vy: 0 }), map, 0, 0.1);
    expect(next.landed).toBe(false);
  });

  it('keeps ticking the fuse down once landed, without moving', () => {
    const landed = makeGrenade({ landed: true, fuseRemainingSeconds: 1 });
    const map = buildMap(['..']);
    const next = stepGrenade(landed, map, 1000, 0.1);
    expect(next.x).toBe(landed.x);
    expect(next.y).toBe(landed.y);
    expect(next.fuseRemainingSeconds).toBeCloseTo(0.9);
  });
});

describe('grenadeDamageAtDistance', () => {
  it('deals full damage at the center', () => {
    expect(grenadeDamageAtDistance(90, 0, 96)).toBe(90);
  });

  it('falls off linearly toward the edge', () => {
    expect(grenadeDamageAtDistance(90, 48, 96)).toBeCloseTo(45);
  });

  it('deals nothing beyond the radius', () => {
    expect(grenadeDamageAtDistance(90, 100, 96)).toBe(0);
  });
});
