import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../config/movement';
import { bodyOverlapsSolid, EPS } from '../physics/collision';
import { step } from '../physics/step';
import type { PlayerInput, PlayerState } from '../types';
import { input, makeMap, mulberry32, openRoom, testPlayer } from './helpers';

const NORMAL = { gravity: 100, boost: 100 };
const T = 32;

/** A tall room (30 rows): the bottom border is row 29, so the floor top is at y = 29 * 32 = 928; ceiling bottom at y = 32. */
const room = () => openRoom(20, 30, T);
const FLOOR_TOP = 29 * T;

function run(state: PlayerState, inputs: PlayerInput[], map = room(), settings = NORMAL) {
  let s = state;
  for (const i of inputs) s = step(s, i, map, settings);
  return s;
}
const repeat = (n: number, i: PlayerInput) => Array.from({ length: n }, () => i);

describe('physics: gravity and landing', () => {
  it('falls and lands on the floor tile, then stands still', () => {
    const start = testPlayer({ x: 300, y: 500 });
    const s = run(start, repeat(120, input()));
    expect(s.onGround).toBe(true);
    expect(s.vy).toBe(0);
    expect(s.y).toBeCloseTo(FLOOR_TOP, 2);
    expect(s.y).toBeLessThan(FLOOR_TOP); // never inside the floor
    expect(s.y).toBeCloseTo(FLOOR_TOP - EPS, 5);
  });

  it('reaches terminal fall speed and does not exceed it', () => {
    const s = run(testPlayer({ x: 300, y: 60 }), repeat(40, input()));
    expect(s.vy).toBeLessThanOrEqual(MOVEMENT.maxFallSpeed);
  });

  it('gravity 100 falls; gravity 0 floats in place', () => {
    const start = testPlayer({ x: 300, y: 500 });
    const falling = run(start, repeat(30, input()), room(), { gravity: 100, boost: 100 });
    expect(falling.y).toBeGreaterThan(start.y + 100);

    const floating = run(start, repeat(90, input()), room(), { gravity: 0, boost: 100 });
    expect(Math.abs(floating.y - start.y)).toBeLessThan(1);
    expect(Math.abs(floating.vy)).toBeLessThan(0.01);
    expect(floating.onGround).toBe(false);
  });

  it('gravity scales linearly in between', () => {
    const start = testPlayer({ x: 300, y: 400 });
    const dy = (g: number) => run(start, repeat(15, input()), room(), { gravity: g, boost: 100 }).y - start.y;
    expect(dy(100)).toBeGreaterThan(dy(50));
    expect(dy(50)).toBeGreaterThan(dy(10));
    expect(dy(10)).toBeGreaterThan(dy(0) - 0.001);
  });
});

describe('physics: walking', () => {
  it('walks right at walk speed and stops at a wall', () => {
    const grounded = run(testPlayer({ x: 100, y: 500 }), repeat(120, input()));
    const right = run(grounded, repeat(40, input({ moveX: 1 })));
    expect(right.x).toBeGreaterThan(grounded.x + 100);
    expect(right.vx).toBeLessThanOrEqual(MOVEMENT.walkSpeed + 1e-9);

    const wall = run(right, repeat(300, input({ moveX: 1 })));
    const wallLeftEdge = 19 * T; // right border column starts here
    expect(wall.x + MOVEMENT.width / 2).toBeLessThanOrEqual(wallLeftEdge);
    expect(wall.x + MOVEMENT.width / 2).toBeCloseTo(wallLeftEdge - EPS, 3);
    expect(wall.vx).toBe(0);
  });

  it('follows the aim direction for facing', () => {
    const s = step(testPlayer({ onGround: true }), input({ aimAngle: Math.PI }), room(), NORMAL);
    expect(s.facing).toBe(-1);
    const r = step(s, input({ aimAngle: 0.1 }), room(), NORMAL);
    expect(r.facing).toBe(1);
  });

  it('ignores a garbage moveX (NaN, huge) instead of misbehaving', () => {
    const base = run(testPlayer({ x: 300, y: 500 }), repeat(120, input()));
    const nan = step(base, input({ moveX: NaN }), room(), NORMAL);
    expect(Number.isFinite(nan.x) && Number.isFinite(nan.vx)).toBe(true);
    const huge = run(base, repeat(60, input({ moveX: 1e9 })));
    expect(huge.vx).toBeLessThanOrEqual(MOVEMENT.walkSpeed + 1e-9);
  });
});

describe('physics: jetpack and boost setting', () => {
  const midAir = () => testPlayer({ x: 300, y: 700 });

  it('thrust lifts the player', () => {
    const s = run(midAir(), repeat(15, input({ fly: true })));
    expect(s.y).toBeLessThan(700);
    expect(s.flying).toBe(true);
    expect(s.vy).toBeGreaterThanOrEqual(-MOVEMENT.maxRiseSpeed);
  });

  it('boost 100: no drain, the fuel bar stays full', () => {
    const s = run(midAir(), repeat(30, input({ fly: true })), room(), { gravity: 100, boost: 100 });
    expect(s.fuel).toBe(MOVEMENT.fuelCapacity);
  });

  it('boost 50 drains at half the fastest rate; boost 0 drains very fast', () => {
    const drainOver1s = (boost: number) => {
      const s = run(midAir(), repeat(30, input({ fly: true })), room(), { gravity: 100, boost });
      return MOVEMENT.fuelCapacity - s.fuel;
    };
    expect(drainOver1s(50)).toBeCloseTo(50, 1);
    expect(drainOver1s(90)).toBeCloseTo(10, 1);
    expect(drainOver1s(0)).toBeCloseTo(100, 1);
    expect(drainOver1s(0)).toBeGreaterThan(drainOver1s(50));
  });

  it('runs out of fuel: thrust stops and the player falls', () => {
    const empty = run(midAir(), repeat(60, input({ fly: true })), room(), { gravity: 100, boost: 0 });
    expect(empty.fuel).toBe(0);
    expect(empty.flying).toBe(false);
    const later = run(empty, repeat(10, input({ fly: true })), room(), { gravity: 100, boost: 0 });
    expect(later.y).toBeGreaterThan(empty.y);
  });

  it('holding fly with an empty tank does nothing: no refill, no flickering thrust', () => {
    const held = run(midAir(), repeat(90, input({ fly: true })), room(), { gravity: 100, boost: 0 });
    expect(held.fuel).toBe(0);
    // every tick after it is empty must be non-thrusting
    let s = held;
    for (let i = 0; i < 20; i++) {
      s = step(s, input({ fly: true }), room(), { gravity: 100, boost: 0 });
      expect(s.flying).toBe(false);
      expect(s.fuel).toBe(0);
    }
    // releasing the button lets the tank recharge
    const released = step(s, input(), room(), { gravity: 100, boost: 0 });
    expect(released.fuel).toBeGreaterThan(0);
  });

  it('refills when not flying (faster on the ground than in the air)', () => {
    const lowFuel = { boost: 50, gravity: 100 };
    const unused = run(midAir(), repeat(15, input()), room(), lowFuel);
    expect(unused.fuel).toBe(MOVEMENT.fuelCapacity); // a full tank stays full
    const drained = testPlayer({ x: 300, y: 700, fuel: 0 });
    const inAir = step(drained, input(), room(), lowFuel);
    const ground = step({ ...drained, y: FLOOR_TOP, onGround: true }, input(), room(), lowFuel);
    expect(inAir.fuel).toBeGreaterThan(0);
    expect(ground.fuel).toBeGreaterThan(inAir.fuel);

    const full = run(drained, repeat(120, input()), room(), lowFuel);
    expect(full.fuel).toBe(MOVEMENT.fuelCapacity);
  });
});

describe('physics: crouch', () => {
  const grounded = () => run(testPlayer({ x: 300, y: 500 }), repeat(120, input()));

  it('crouches only on the ground', () => {
    const g = grounded();
    expect(step(g, input({ crouch: true }), room(), NORMAL).crouching).toBe(true);
    const air = testPlayer({ x: 300, y: 600, onGround: false });
    expect(step(air, input({ crouch: true }), room(), NORMAL).crouching).toBe(false);
  });

  it('stands up when the crouch input is released', () => {
    const c = step(grounded(), input({ crouch: true }), room(), NORMAL);
    expect(step(c, input(), room(), NORMAL).crouching).toBe(false);
  });

  it('crouching is slower than walking', () => {
    const g = grounded();
    const walk = run(g, repeat(30, input({ moveX: 1 })));
    const crouchWalk = run(g, repeat(30, input({ moveX: 1, crouch: true })));
    expect(crouchWalk.x - g.x).toBeLessThan((walk.x - g.x) * 0.6);
  });

  it('cannot stand up under a ceiling that only a crouching body fits under', () => {
    // 20 px tiles: a 2-tile (40 px) tunnel fits the 30 px crouch box but not the 48 px standing box
    const tunnel = makeMap(
      [
        '####################',
        '####################',
        '#..................#',
        '#..................#',
        '####################',
      ],
      20,
    );
    const floorTop = 4 * 20;
    let s = testPlayer({ x: 100, y: floorTop - EPS, onGround: true, crouching: true });
    s = step(s, input({ crouch: true }), tunnel, NORMAL);
    expect(s.crouching).toBe(true);
    s = step(s, input({ crouch: false }), tunnel, NORMAL);
    expect(s.crouching).toBe(true); // blocked from standing
    expect(bodyOverlapsSolid(tunnel, s.x, s.y, MOVEMENT.width, MOVEMENT.crouchHeight)).toBe(false);
  });
});

describe('physics: collision never lets a body into a wall', () => {
  it('cannot pass through walls, floor or ceiling at absurd speeds', () => {
    const map = room();
    const speeds = [60, 400, 3000, 50_000];
    for (const v of speeds) {
      for (const [vx, vy] of [
        [v, 0],
        [-v, 0],
        [0, v],
        [0, -v],
        [v, v],
        [-v, -v],
      ]) {
        const s = step(testPlayer({ x: 300, y: 500, vx, vy }), input(), map, NORMAL);
        expect(bodyOverlapsSolid(map, s.x, s.y, MOVEMENT.width, MOVEMENT.standHeight), `v=${vx},${vy}`).toBe(
          false,
        );
        expect(s.x).toBeGreaterThan(T);
        expect(s.x).toBeLessThan(19 * T);
        expect(s.y).toBeLessThanOrEqual(FLOOR_TOP);
      }
    }
  });

  it('stays inside a closed room through thousands of random-velocity steps', () => {
    const map = room();
    const rnd = mulberry32(7);
    let s = testPlayer({ x: 300, y: 500 });
    for (let i = 0; i < 3000; i++) {
      s = { ...s, vx: (rnd() - 0.5) * 12000, vy: (rnd() - 0.5) * 12000 };
      s = step(s, input({ moveX: rnd() * 2 - 1, fly: rnd() < 0.5, crouch: rnd() < 0.3 }), map, NORMAL);
      const h = s.crouching ? MOVEMENT.crouchHeight : MOVEMENT.standHeight;
      expect(bodyOverlapsSolid(map, s.x, s.y, MOVEMENT.width, h)).toBe(false);
    }
  });

  it('a solid platform stops a fast fall', () => {
    const map = makeMap([
      '##########', // 0 ceiling
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#.######.#', // 6 platform: top at y = 192
      '#........#',
      '#........#',
      '##########', // 9 floor
    ]);
    // Fall speed is capped at maxFallSpeed (900 px/s = 30 px per tick), so a huge vy becomes 900 — start
    // 22 px above the platform so this very step crosses its surface and must be stopped by it.
    const s = step(testPlayer({ x: 160, y: 170, vy: 40_000 }), input(), map, NORMAL);
    expect(s.y).toBeCloseTo(6 * T - EPS, 3); // stopped on top of the platform, not below it
    expect(s.vy).toBe(0);
    expect(s.onGround).toBe(true);
  });

  it('a long fall from high up lands on the platform and never ends up below it', () => {
    const map = makeMap([
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#.######.#', // platform top at y = 192
      '#........#',
      '#........#',
      '##########',
    ]);
    let s = testPlayer({ x: 160, y: 90 });
    for (let i = 0; i < 120; i++) {
      s = step(s, input(), map, NORMAL);
      expect(s.y).toBeLessThanOrEqual(6 * T);
    }
    expect(s.y).toBeCloseTo(6 * T - EPS, 3);
    expect(s.onGround).toBe(true);
  });
});

describe('physics: purity and determinism', () => {
  const script = (): PlayerInput[] => {
    const rnd = mulberry32(99);
    return Array.from({ length: 300 }, (_, i) =>
      input({
        seq: i + 1,
        moveX: Math.round((rnd() * 2 - 1) * 4) / 4,
        fly: rnd() < 0.4,
        crouch: rnd() < 0.2,
        aimAngle: rnd() * 6.28 - 3.14,
      }),
    );
  };

  it('the same inputs always give the same result (run twice)', () => {
    const a = run(testPlayer({ x: 300, y: 500 }), script(), room(), { gravity: 70, boost: 40 });
    const b = run(testPlayer({ x: 300, y: 500 }), script(), room(), { gravity: 70, boost: 40 });
    expect(a).toEqual(b);
  });

  it('does not mutate the state or the input it is given', () => {
    const state = testPlayer({ x: 300, y: 500 });
    const snapshot = JSON.stringify(state);
    const i = input({ moveX: 1, fly: true });
    const iSnap = JSON.stringify(i);
    step(state, i, room(), NORMAL);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(JSON.stringify(i)).toBe(iSnap);
  });

  it('echoes the input sequence number back for client reconciliation', () => {
    expect(step(testPlayer(), input({ seq: 42 }), room(), NORMAL).lastInputSeq).toBe(42);
  });

  it('dead players do not move', () => {
    const dead = testPlayer({ alive: false, x: 300, y: 500 });
    expect(step(dead, input({ moveX: 1, fly: true }), room(), NORMAL)).toBe(dead);
  });
});
