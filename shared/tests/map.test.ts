import { describe, expect, it } from 'vitest';
import { MAP_RULES } from '../config/map';
import { MOVEMENT } from '../config/movement';
import { CATACOMBS, CATACOMBS_JSON } from '../maps/catacombs';
import { loadMap, type TiledMapJson, type TiledLayer } from '../maps/loadMap';
import { validateMap } from '../maps/validateMap';
import { bodyOverlapsSolid } from '../physics/collision';
import { step } from '../physics/step';
import { input, testPlayer } from './helpers';

const T = MAP_RULES.tileSize;

/** A deep copy of the real map JSON that a test can break on purpose. */
const clone = () => structuredClone(CATACOMBS_JSON) as TiledMapJson;
const layer = <K extends string>(json: TiledMapJson, name: string) =>
  json.layers.find((l) => l.name === name) as Extract<TiledLayer, { type: K }>;
const collisionData = (json: TiledMapJson) => layer<'tilelayer'>(json, 'collision').data;
const spawns = (json: TiledMapJson) => layer<'objectgroup'>(json, 'spawnPoints').objects;
const pickups = (json: TiledMapJson) => layer<'objectgroup'>(json, 'pickupSpots').objects;
const errorsOf = (json: TiledMapJson) => validateMap(loadMap(json)).errors.join(' | ');

describe('the Catacombs map (Game Flow, Section 16)', () => {
  it('is 100 x 60 tiles of 32 px', () => {
    expect(CATACOMBS.tileSize).toBe(32);
    expect(CATACOMBS.widthTiles).toBe(100);
    expect(CATACOMBS.heightTiles).toBe(60);
    expect(CATACOMBS.widthPx).toBe(3200);
    expect(CATACOMBS.heightPx).toBe(1920);
  });

  it('has exactly 16 spawn points and 14 pickup spots', () => {
    expect(CATACOMBS.spawnPoints).toHaveLength(16);
    expect(CATACOMBS.pickupSpots).toHaveLength(14);
  });

  it('passes every validation check', () => {
    const report = validateMap(CATACOMBS);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats.minSpawnPickupDistancePx).toBeGreaterThanOrEqual(160);
    expect(report.stats.reachablePositions).toBe(report.stats.freePositions);
  });

  it('every spawn point is at least 5 tiles (160 px) from every pickup spot', () => {
    for (const s of CATACOMBS.spawnPoints) {
      for (const p of CATACOMBS.pickupSpots)
        expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThanOrEqual(160);
    }
  });

  it('no spawn point or pickup spot is inside a solid tile', () => {
    for (const p of [...CATACOMBS.spawnPoints, ...CATACOMBS.pickupSpots]) {
      expect(CATACOMBS.collision.isSolid(Math.floor(p.x / T), Math.floor(p.y / T))).toBe(false);
    }
  });

  it('is mirror-symmetric left to right (spawns and pickups)', () => {
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    for (const list of [CATACOMBS.spawnPoints, CATACOMBS.pickupSpots]) {
      const set = new Set(list.map(key));
      for (const p of list) expect(set.has(key({ x: CATACOMBS.widthPx - p.x, y: p.y }))).toBe(true);
    }
  });

  it('the boundary is fully closed', () => {
    const { widthTiles: w, heightTiles: h, collision } = CATACOMBS;
    for (let x = 0; x < w; x++) {
      expect(collision.isSolid(x, 0)).toBe(true);
      expect(collision.isSolid(x, h - 1)).toBe(true);
    }
    for (let y = 0; y < h; y++) {
      expect(collision.isSolid(0, y)).toBe(true);
      expect(collision.isSolid(w - 1, y)).toBe(true);
    }
  });
});

describe('the server can answer "is this tile solid?"', () => {
  const c = CATACOMBS.collision;

  it('walls are solid, open tunnel air is not, outside the map is solid', () => {
    expect(c.isSolid(0, 0)).toBe(true);
    expect(c.isSolid(50, 5)).toBe(false); // top tunnel
    expect(c.isSolid(50, 54)).toBe(false); // bottom tunnel
    expect(c.isSolid(49, 29)).toBe(true); // central block
    expect(c.isSolid(25, 14)).toBe(false); // crossing of corridors
    expect(c.isSolid(-1, 10)).toBe(true);
    expect(c.isSolid(10, -1)).toBe(true);
    expect(c.isSolid(100, 10)).toBe(true);
    expect(c.isSolid(10, 60)).toBe(true);
  });

  it('platforms are solid; the background layer never is', () => {
    expect(c.isSolid(33, 27)).toBe(true); // long middle platform
    const tileset = CATACOMBS_JSON.tilesets[0];
    const solidIds = tileset
      .tiles!.filter((t) => t.properties?.some((p) => p.name === 'solid' && p.value === true))
      .map((t) => tileset.firstgid + t.id);
    expect(solidIds.sort()).toEqual([1, 2, 4]); // wall, platform, cave edge
    expect(solidIds).not.toContain(3); // background
  });

  it('the solid grid has real content (not empty, not all solid)', () => {
    const solid = CATACOMBS.solid.reduce((a, b) => a + b, 0);
    expect(solid).toBeGreaterThan(CATACOMBS.solid.length * 0.2);
    expect(solid).toBeLessThan(CATACOMBS.solid.length * 0.8);
  });
});

describe('physics works on the real map', () => {
  const settings = { gravity: 100, boost: 100 };

  it('every spawn point drops the player onto a floor close below, inside the map', () => {
    for (const s of CATACOMBS.spawnPoints) {
      let p = testPlayer({ x: s.x, y: s.y });
      for (let i = 0; i < 60; i++) p = step(p, input(), CATACOMBS.collision, settings);
      expect(p.onGround).toBe(true);
      expect(Math.abs(p.y - s.y)).toBeLessThan(T * 2);
      expect(bodyOverlapsSolid(CATACOMBS.collision, p.x, p.y, MOVEMENT.width, MOVEMENT.standHeight)).toBe(
        false,
      );
    }
  });

  it('a player cannot leave the map however long they fly or walk in any direction', () => {
    const dirs = [
      { moveX: 1, fly: true },
      { moveX: -1, fly: true },
      { moveX: 1, fly: false },
      { moveX: -1, fly: false },
      { moveX: 0, fly: true },
    ];
    for (const d of dirs) {
      let p = testPlayer({ x: CATACOMBS.spawnPoints[0].x, y: CATACOMBS.spawnPoints[0].y });
      for (let i = 0; i < 900; i++) p = step(p, input(d), CATACOMBS.collision, { gravity: 100, boost: 100 });
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(CATACOMBS.widthPx);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(CATACOMBS.heightPx);
    }
  });

  it('the jetpack can lift a player from a bottom-tunnel spawn up into the top tunnel', () => {
    const start = CATACOMBS.spawnPoints.find((s) => s.y > 1800)!; // a bottom-tunnel spawn
    let p = testPlayer({ x: start.x, y: start.y });
    // fly straight up through the shaft at x = 25 (a corridor that runs the whole height)
    p = { ...p, x: 25 * T + 16 };
    let minY = p.y;
    for (let i = 0; i < 400; i++) {
      p = step(p, input({ fly: true }), CATACOMBS.collision, settings);
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBeLessThan(10 * T); // reached the top tunnel (above the slab)
  });
});

describe('the validator catches bad maps', () => {
  it('too few spawn points', () => {
    const j = clone();
    spawns(j).pop();
    expect(errorsOf(j)).toContain('15 spawn points, expected exactly 16');
  });

  it('too many pickup spots', () => {
    const j = clone();
    const objs = pickups(j);
    objs.push({ ...objs[0], id: 999, x: 1600, y: 300 });
    expect(errorsOf(j)).toContain('15 pickup spots, expected exactly 14');
  });

  it('a spawn point inside a solid tile', () => {
    const j = clone();
    spawns(j)[3].x = 49 * T + 16; // the central block
    spawns(j)[3].y = 29 * T + 16;
    expect(errorsOf(j)).toContain('spawn point 4');
    expect(errorsOf(j)).toContain('inside a solid tile');
  });

  it('a pickup spot inside a solid tile', () => {
    const j = clone();
    pickups(j)[0].x = 49 * T + 16;
    pickups(j)[0].y = 29 * T + 16;
    expect(errorsOf(j)).toContain('pickup spot 1');
  });

  it('a pickup spot closer than 160 px to a spawn point', () => {
    const j = clone();
    const s = spawns(j)[0];
    pickups(j)[0].x = s.x + 100;
    pickups(j)[0].y = s.y - 14;
    expect(errorsOf(j)).toMatch(/spawn point 1 is only \d+ px from pickup spot 1/);
  });

  it('exactly 160 px is allowed, 159 px is not', () => {
    const base = clone();
    const s = spawns(base)[0];
    // put pickup 1 exactly 160 px to the right of spawn 1, and park all other pickups far away
    const place = (dx: number) => {
      const j = structuredClone(base);
      pickups(j)[0].x = s.x + dx;
      pickups(j)[0].y = s.y;
      return errorsOf(j);
    };
    expect(place(160)).not.toMatch(/spawn point 1 is only/);
    expect(place(159)).toMatch(/spawn point 1 is only 159 px/);
  });

  it('an open hole in the outer boundary', () => {
    const j = clone();
    collisionData(j)[0 * 100 + 50] = 0; // top edge, x = 50
    expect(errorsOf(j)).toContain('the map boundary is not closed: 1 open tiles on the outer edge');
  });

  it('a sealed-off room that the soldier fits in', () => {
    const j = clone();
    const data = collisionData(j);
    for (let y = 19; y <= 22; y++) for (let x = 10; x <= 17; x++) data[y * 100 + x] = 0; // hollow inside a block
    const e = errorsOf(j);
    expect(e).toContain('cannot be reached (sealed-off area)');
  });

  it('the wrong map size', () => {
    const j = clone();
    j.width = 99;
    expect(() => loadMap(j)).toThrow(/wrong size/);
    const k = clone();
    k.tilewidth = 16;
    k.tileheight = 16;
    expect(errorsOf(k)).toContain('tile size is 16, expected 32');
  });

  it('a map without the required layers is rejected with a clear message', () => {
    const j = clone();
    j.layers = j.layers.filter((l) => l.name !== 'pickupSpots');
    expect(() => loadMap(j)).toThrow(/no objectgroup named "pickupSpots"/);
  });
});
