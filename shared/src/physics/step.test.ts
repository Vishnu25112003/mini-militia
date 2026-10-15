import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../config/movement.js';
import type { PlayerInput, PlayerState } from '../types/player.js';
import type { CollisionMap } from './map.js';
import { PLAYER_HALF_HEIGHT, step } from './step.js';

const TILE_SIZE = 32;

function buildMap(rows: string[]): CollisionMap {
  const widthInTiles = rows[0]!.length;
  const heightInTiles = rows.length;
  return {
    tileSize: TILE_SIZE,
    widthInTiles,
    heightInTiles,
    isSolidTile(tileX, tileY) {
      return rows[tileY]?.[tileX] === '#';
    },
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    name: 'Tester',
    color: '#e6194b',
    position: { x: 80, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 'right',
    health: 100,
    fuel: 100,
    crouching: false,
    onGround: false,
    slots: [
      { kind: 'single', weapon: 'AK47', ammoInMagazine: 30, ammoReserve: 90 },
      { kind: 'single', weapon: 'M14', ammoInMagazine: 15, ammoReserve: 45 },
    ],
    activeSlotIndex: 0,
    grenades: { Fragnade: 2, Gasnade: 2, Proxynade: 0 },
    kills: 0,
    deaths: 0,
    points: 0,
    gotKillThisLife: false,
    shieldSecondsRemaining: 0,
    alive: true,
    ...overrides,
  };
}

const NO_INPUT: PlayerInput = {
  moveX: 0,
  fly: false,
  crouch: false,
  aimAngle: 0,
  fire: false,
  melee: false,
  throwGrenade: false,
  reload: false,
  swapSlot: false,
  pickupOrPair: false,
  sequence: 0,
};

const NORMAL_SETTINGS = { gravity: 100, boost: 100 };

describe('step — walking', () => {
  it('moves left/right at the configured walk speed', () => {
    const map = buildMap(['.....', '.....', '#####']);
    // Resting on the floor (row 2 starts at y=64): center = floor top - half height.
    const player = makePlayer({ position: { x: 80, y: 40 }, onGround: true });

    const moved = step(player, { ...NO_INPUT, moveX: 1 }, map, NORMAL_SETTINGS);
    expect(moved.position.x).toBeCloseTo(80 + MOVEMENT.walkSpeedPxPerSec / MOVEMENT.tickRate);
  });

  it('crouching (on the ground, pulling down) stops horizontal movement', () => {
    const map = buildMap(['.....', '.....', '#####']);
    const player = makePlayer({ position: { x: 80, y: 40 }, onGround: true });

    const moved = step(player, { ...NO_INPUT, moveX: 1, crouch: true }, map, NORMAL_SETTINGS);
    expect(moved.crouching).toBe(true);
    expect(moved.position.x).toBe(80);
  });

  it('crouch has no effect while airborne', () => {
    const map = buildMap(['.....', '.....', '#####']);
    const player = makePlayer({ position: { x: 80, y: 0 }, onGround: false });

    const moved = step(player, { ...NO_INPUT, moveX: 1, crouch: true }, map, NORMAL_SETTINGS);
    expect(moved.crouching).toBe(false);
    expect(moved.position.x).not.toBe(80);
  });
});

describe('step — facing', () => {
  it('follows aim direction, not movement direction', () => {
    const map = buildMap(['.....', '.....', '#####']);
    const player = makePlayer({ position: { x: 80, y: 40 }, onGround: true, facing: 'left' });

    // Walking left but aiming right (aimAngle 0) faces right.
    const aimingRight = step(player, { ...NO_INPUT, moveX: -1, aimAngle: 0 }, map, NORMAL_SETTINGS);
    expect(aimingRight.facing).toBe('right');

    // Walking right but aiming left (aimAngle = π) faces left.
    const aimingLeft = step(
      player,
      { ...NO_INPUT, moveX: 1, aimAngle: Math.PI },
      map,
      NORMAL_SETTINGS,
    );
    expect(aimingLeft.facing).toBe('left');
  });
});

describe('step — gravity and landing', () => {
  it('falls and comes to rest on a floor, never sinking through it', () => {
    const map = buildMap(['.....', '.....', '.....', '#####']);
    const floorTopY = 3 * TILE_SIZE;

    let player = makePlayer({ position: { x: 80, y: 20 }, onGround: false });
    for (let i = 0; i < 300; i++) {
      player = step(player, NO_INPUT, map, NORMAL_SETTINGS);
      expect(player.position.y + PLAYER_HALF_HEIGHT).toBeLessThanOrEqual(floorTopY + 0.001);
    }

    expect(player.onGround).toBe(true);
    expect(player.velocity.y).toBe(0);

    const restingY = player.position.y;
    const again = step(player, NO_INPUT, map, NORMAL_SETTINGS);
    expect(again.position.y).toBeCloseTo(restingY);
    expect(again.onGround).toBe(true);
  });

  it('does not tunnel through a thin floor even at terminal velocity', () => {
    // Floor is a single tile (row 9); row 10 is open space a tunneling bug would fall into.
    const rows = [
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
      '#####',
      '.....',
    ];
    const map = buildMap(rows);
    const floorTopY = 9 * TILE_SIZE;

    const player = makePlayer({
      // Just above the floor (not already overlapping it) by less than one tick's travel at terminal velocity.
      position: { x: 80, y: floorTopY - PLAYER_HALF_HEIGHT - 6 },
      velocity: { x: 0, y: MOVEMENT.terminalVelocityPxPerSec },
      onGround: false,
    });

    const moved = step(player, NO_INPUT, map, NORMAL_SETTINGS);
    expect(moved.position.y + PLAYER_HALF_HEIGHT).toBeLessThanOrEqual(floorTopY + 0.001);
    expect(moved.onGround).toBe(true);
  });

  it('gravity setting 0 means floating: no downward acceleration', () => {
    const map = buildMap(['.....', '.....', '.....', '#####']);
    let player = makePlayer({ position: { x: 80, y: 20 }, onGround: false });

    for (let i = 0; i < 60; i++) {
      player = step(player, NO_INPUT, map, { gravity: 0, boost: 100 });
    }

    expect(player.velocity.y).toBe(0);
    expect(player.position.y).toBe(20);
  });
});

describe('step — jetpack and fuel', () => {
  const map = buildMap(['.....', '.....', '.....', '#####']);

  it('flying applies upward thrust and drains fuel', () => {
    const player = makePlayer({ position: { x: 80, y: 60 }, fuel: 100, onGround: false });
    const moved = step(player, { ...NO_INPUT, fly: true }, map, { gravity: 100, boost: 50 });

    expect(moved.velocity.y).toBeLessThan(0);
    expect(moved.fuel).toBeLessThan(100);
  });

  it('boost setting 100 means no drain at all while flying', () => {
    let player = makePlayer({ position: { x: 80, y: 60 }, fuel: 100, onGround: false });
    for (let i = 0; i < 30; i++) {
      player = step(player, { ...NO_INPUT, fly: true }, map, { gravity: 100, boost: 100 });
    }
    expect(player.fuel).toBe(100);
  });

  it('a lower boost setting drains fuel faster', () => {
    let fast = makePlayer({ position: { x: 80, y: 60 }, fuel: 100, onGround: false });
    let slow = makePlayer({ position: { x: 80, y: 60 }, fuel: 100, onGround: false });
    for (let i = 0; i < 10; i++) {
      fast = step(fast, { ...NO_INPUT, fly: true }, map, { gravity: 100, boost: 0 });
      slow = step(slow, { ...NO_INPUT, fly: true }, map, { gravity: 100, boost: 50 });
    }
    expect(fast.fuel).toBeLessThan(slow.fuel);
  });

  it('fuel refills while not flying, capped at capacity', () => {
    let player = makePlayer({ position: { x: 80, y: 60 }, onGround: true, fuel: 50 });
    for (let i = 0; i < 10; i++) {
      player = step(player, NO_INPUT, map, NORMAL_SETTINGS);
    }
    expect(player.fuel).toBeGreaterThan(50);

    for (let i = 0; i < 100; i++) {
      player = step(player, NO_INPUT, map, NORMAL_SETTINGS);
    }
    expect(player.fuel).toBe(MOVEMENT.fuelCapacity);
  });

  it('cannot fly with zero fuel', () => {
    const player = makePlayer({ position: { x: 80, y: 60 }, fuel: 0, onGround: false });
    const moved = step(player, { ...NO_INPUT, fly: true }, map, NORMAL_SETTINGS);
    expect(moved.velocity.y).toBeGreaterThan(0); // gravity took over instead of thrust
  });
});

describe('step — determinism', () => {
  it('gives identical results for identical inputs', () => {
    const map = buildMap(['.....', '.....', '.....', '#####']);
    const player = makePlayer({ position: { x: 80, y: 20 }, onGround: false });
    const input = { ...NO_INPUT, moveX: 1 as const, fly: true };

    const a = step(player, input, map, NORMAL_SETTINGS);
    const b = step(player, input, map, NORMAL_SETTINGS);
    expect(a).toEqual(b);
  });
});
