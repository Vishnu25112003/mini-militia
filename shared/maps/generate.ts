/**
 * Builds `catacombs.json` (a real Tiled map file) and its placeholder
 * tileset image, entirely in code — there's no Tiled GUI in this
 * environment. The layout is generated from the same structural rules the
 * flow describes (octagon boundary, top/bottom cave tunnels, a cross-shaped
 * corridor lattice, a central block, mirror symmetry) rather than copying
 * any existing map, and the whole thing is deterministic: no RNG anywhere,
 * so re-running this script always produces byte-identical output.
 *
 * Run with: npx tsx maps/generate.ts
 */
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOLID_TILES,
  TILESET_COLUMNS,
  TILESET_FIRST_GID,
  TILESET_TILE_COUNT,
  TILE_COLORS,
  TILE_LOCAL_IDS,
  TILE_SIZE,
  gidFor,
  type TileName,
} from '../src/maps/tileset.js';
import { isPositionClearForPlayer } from '../src/physics/step.js';
import type { CollisionMap } from '../src/physics/map.js';

const MAP_WIDTH = 100;
const MAP_HEIGHT = 60;
const QUAD_WIDTH = MAP_WIDTH / 2;
const QUAD_HEIGHT = MAP_HEIGHT / 2;

const BOUNDARY_THICKNESS = 3;
const TOP_ROOF_THICKNESS = 2;
const TUNNEL_HEIGHT = 4;
const TUNNEL_END = TOP_ROOF_THICKNESS + TUNNEL_HEIGHT;
const LATTICE_BLOCK = 4;
const LATTICE_GAP = 3;
const LATTICE_PERIOD = LATTICE_BLOCK + LATTICE_GAP;
const CORNER_CUT = 10;

const CENTRAL_BLOCK_WIDTH = 10;
const CENTRAL_BLOCK_HEIGHT = 8;

const SPAWN_POINT_COUNT = 16;
const PICKUP_SPOT_COUNT = 14;
const MIN_SPAWN_TO_PICKUP_PX = 5 * TILE_SIZE;

type TileKind = 'open' | TileName;

/** The top-left quadrant's tile kind; the full map mirrors this 4 ways. */
function quadrantKind(qx: number, qy: number): TileKind {
  let solid = false;
  let kind: TileKind = 'open';

  // Interior cross-corridor lattice: a grid of rock blocks separated by
  // corridors that cross in '+' shapes at each junction.
  if (qx >= BOUNDARY_THICKNESS && qy >= TUNNEL_END) {
    const lx = (qx - BOUNDARY_THICKNESS) % LATTICE_PERIOD;
    const ly = (qy - TUNNEL_END) % LATTICE_PERIOD;
    if (lx < LATTICE_BLOCK && ly < LATTICE_BLOCK) {
      solid = true;
      kind = 'platform';
    }
  }

  // Top cave tunnel: a horizontal shaft running the width of the map, just
  // inside the roof — carved through rock, not a hole in the outer wall.
  if (qy >= TOP_ROOF_THICKNESS && qy < TUNNEL_END) {
    solid = false;
    kind = 'open';
  }

  // The rock roof above the tunnel.
  if (qy < TOP_ROOF_THICKNESS) {
    solid = true;
    kind = 'wall';
  }

  // The left outer wall, below the tunnel band.
  if (qx < BOUNDARY_THICKNESS && qy >= TUNNEL_END) {
    solid = true;
    kind = 'wall';
  }

  // Octagon-style chamfered corner.
  if (qx + qy < CORNER_CUT) {
    solid = true;
    kind = 'caveEdge';
  }

  // Absolute edge: always sealed, regardless of anything above.
  if (qx === 0 || qy === 0) {
    solid = true;
    kind = 'caveEdge';
  }

  return solid ? kind : 'open';
}

function buildGrid(): TileKind[][] {
  const grid: TileKind[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, (): TileKind => 'open'),
  );

  for (let fy = 0; fy < MAP_HEIGHT; fy++) {
    for (let fx = 0; fx < MAP_WIDTH; fx++) {
      const qx = fx < QUAD_WIDTH ? fx : MAP_WIDTH - 1 - fx;
      const qy = fy < QUAD_HEIGHT ? fy : MAP_HEIGHT - 1 - fy;
      grid[fy]![fx] = quadrantKind(qx, qy);
    }
  }

  // Central block, stamped last so it's unconditionally symmetric (it's
  // centered exactly on both mirror axes).
  const left = Math.round((MAP_WIDTH - CENTRAL_BLOCK_WIDTH) / 2);
  const top = Math.round((MAP_HEIGHT - CENTRAL_BLOCK_HEIGHT) / 2);
  for (let fy = top; fy < top + CENTRAL_BLOCK_HEIGHT; fy++) {
    for (let fx = left; fx < left + CENTRAL_BLOCK_WIDTH; fx++) {
      grid[fy]![fx] = 'caveEdge';
    }
  }

  return grid;
}

function isOpen(grid: TileKind[][], tx: number, ty: number): boolean {
  return grid[ty]?.[tx] === 'open';
}

/**
 * A player's hitbox (48px tall) spans more than one tile, so a spawn/pickup
 * candidate must keep the whole hitbox clear, not just the tile under its
 * center — a single-tile check let spawns land right at the edge of the
 * 4-tile-thick cave tunnels, overlapping the wall above or below it.
 */
function toCollisionMap(grid: TileKind[][]): CollisionMap {
  return {
    tileSize: TILE_SIZE,
    widthInTiles: MAP_WIDTH,
    heightInTiles: MAP_HEIGHT,
    isSolidTile: (tx, ty) => grid[ty]?.[tx] !== 'open',
  };
}

interface Point {
  x: number;
  y: number;
}

function tileCenter(tx: number, ty: number): Point {
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mirrorHorizontal(p: Point): Point {
  return { x: MAP_WIDTH * TILE_SIZE - p.x, y: p.y };
}

function mirrorVertical(p: Point): Point {
  return { x: p.x, y: MAP_HEIGHT * TILE_SIZE - p.y };
}

/** The 4 mirrored copies of a point in the top-left quadrant (may overlap the axes — that's fine, dedup happens by the caller). */
function fourFold(p: Point): Point[] {
  const h = mirrorHorizontal(p);
  return [p, h, mirrorVertical(p), mirrorVertical(h)];
}

/**
 * Deterministic raster scan: walk the quadrant's open tiles in a fixed
 * order, greedily keep one every time it's far enough from every seed
 * already chosen (and, if given, far enough from a set of points to avoid —
 * used to keep spawns away from pickups). No randomness — same input, same
 * output, every time.
 */
function pickSeeds(
  grid: TileKind[][],
  count: number,
  minSpacingTiles: number,
  avoid: { points: Point[]; minDistancePx: number } | null = null,
): Point[] {
  const seeds: Point[] = [];
  const margin = 2;
  const collisionMap = toCollisionMap(grid);

  for (let qy = margin; qy < QUAD_HEIGHT - margin && seeds.length < count; qy++) {
    for (let qx = margin; qx < QUAD_WIDTH - margin && seeds.length < count; qx++) {
      if (!isOpen(grid, qx, qy)) continue;
      const candidate = tileCenter(qx, qy);
      if (!isPositionClearForPlayer(collisionMap, candidate.x, candidate.y)) continue;

      const farFromSeeds = seeds.every(
        (s) => distance(s, candidate) >= minSpacingTiles * TILE_SIZE,
      );
      if (!farFromSeeds) continue;

      if (avoid) {
        const mirrored = fourFold(candidate);
        const farFromAvoided = mirrored.every((m) =>
          avoid.points.every((a) => distance(m, a) >= avoid.minDistancePx),
        );
        if (!farFromAvoided) continue;
      }

      seeds.push(candidate);
    }
  }

  if (seeds.length < count) {
    throw new Error(`pickSeeds: only found ${seeds.length}/${count} seeds`);
  }
  return seeds;
}

function generateSpawnsAndPickups(grid: TileKind[][]): { spawns: Point[]; pickups: Point[] } {
  // Pickups are placed first: 3 seeds fully 4-fold mirrored (12) + 1 seed on
  // the vertical mirror axis (pixel-exact map center), which only
  // vertical-mirrors to a distinct point, contributing 2 more — 14 total.
  for (let pickupSpacing = 16; pickupSpacing >= 6; pickupSpacing--) {
    let pickupSeeds: Point[];
    try {
      pickupSeeds = pickSeeds(grid, 3, pickupSpacing);
    } catch {
      continue;
    }

    const axisSeed: Point = { x: (MAP_WIDTH * TILE_SIZE) / 2, y: tileCenter(0, 3).y };
    const pickups = [...pickupSeeds.flatMap(fourFold), axisSeed, mirrorVertical(axisSeed)];
    if (pickups.length !== PICKUP_SPOT_COUNT) continue;

    // Then spawns (4 seeds, 4-fold mirrored = 16), each candidate's whole
    // mirrored set checked against every pickup directly.
    for (let spawnSpacing = 16; spawnSpacing >= 6; spawnSpacing--) {
      let spawnSeeds: Point[];
      try {
        spawnSeeds = pickSeeds(grid, 4, spawnSpacing, {
          points: pickups,
          minDistancePx: MIN_SPAWN_TO_PICKUP_PX,
        });
      } catch {
        continue;
      }
      const spawns = spawnSeeds.flatMap(fourFold);
      if (spawns.length === SPAWN_POINT_COUNT) {
        return { spawns, pickups };
      }
    }
  }

  throw new Error(
    'generateSpawnsAndPickups: could not find a layout that satisfies every constraint',
  );
}

// --- Tiled JSON assembly -----------------------------------------------

function buildTiledJson(grid: TileKind[][], spawns: Point[], pickups: Point[]) {
  const collisionData: number[] = [];
  const backgroundData: number[] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const kind = grid[y]![x]!;
      if (kind === 'open') {
        collisionData.push(0);
        backgroundData.push(gidFor('background'));
      } else {
        collisionData.push(gidFor('wall'));
        backgroundData.push(gidFor(kind));
      }
    }
  }

  const pointObject = (id: number, name: string, p: Point) => ({
    id,
    name,
    point: true,
    type: '',
    visible: true,
    x: p.x,
    y: p.y,
    width: 0,
    height: 0,
    rotation: 0,
    properties: [],
  });

  let nextObjectId = 1;

  return {
    compressionlevel: -1,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    type: 'map',
    version: '1.10',
    nextlayerid: 5,
    nextobjectid: 1 + spawns.length + pickups.length,
    tilesets: [
      {
        firstgid: TILESET_FIRST_GID,
        name: 'catacombs-placeholder',
        image: 'tileset.png',
        imagewidth: TILESET_COLUMNS * TILE_SIZE,
        imageheight: TILE_SIZE,
        columns: TILESET_COLUMNS,
        tilecount: TILESET_TILE_COUNT,
        tilewidth: TILE_SIZE,
        tileheight: TILE_SIZE,
        margin: 0,
        spacing: 0,
        tiles: Object.entries(TILE_LOCAL_IDS).map(([name, id]) => ({
          id,
          properties: [{ name: 'solid', type: 'bool', value: SOLID_TILES.has(name as TileName) }],
        })),
      },
    ],
    layers: [
      {
        id: 1,
        name: 'background',
        type: 'tilelayer',
        x: 0,
        y: 0,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        opacity: 1,
        visible: true,
        data: backgroundData,
      },
      {
        id: 2,
        name: 'collision',
        type: 'tilelayer',
        x: 0,
        y: 0,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        opacity: 1,
        visible: true,
        data: collisionData,
      },
      {
        id: 3,
        name: 'spawnPoints',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: spawns.map((p, i) => pointObject(nextObjectId++, `spawn${i}`, p)),
      },
      {
        id: 4,
        name: 'pickupSpots',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: pickups.map((p, i) => pointObject(nextObjectId++, `pickup${i}`, p)),
      },
    ],
  };
}

// --- Placeholder tileset image ------------------------------------------

/** Deterministic per-pixel hash noise in [0, 1) — keeps the generated tileset reproducible. */
function noise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Brightness multiplier for one tile pixel: rock grain plus a per-tile structure (bricks, planks, edge shading). */
function tileShade(name: TileName, x: number, y: number): number {
  const last = TILE_SIZE - 1;
  const grain = 0.9 + noise(x, y, name.length) * 0.2;
  switch (name) {
    case 'background':
      return 0.85 + noise(x >> 1, y >> 1, 7) * 0.3;
    case 'wall': {
      // Brick courses: 16px tall rows, joints every 16px, offset on alternate rows.
      const row = y >> 4;
      const mortar = y % 16 === 0 || (x + (row % 2) * 8) % 16 === 0;
      return mortar ? 0.65 : grain;
    }
    case 'platform': {
      // Stone slab: bright lip on top, shadow underneath.
      if (y < 3) return 1.25;
      if (y > last - 3) return 0.6;
      return grain * (x % 16 === 0 ? 0.8 : 1);
    }
    case 'caveEdge': {
      const crack = noise(x >> 2, y >> 2, 99) > 0.8;
      return crack ? 0.55 : grain * 0.85;
    }
  }
}

function buildTilesetPng(): Buffer {
  const width = TILESET_COLUMNS * TILE_SIZE;
  const height = TILE_SIZE;
  const png = new PNG({ width, height });

  for (const [name, localId] of Object.entries(TILE_LOCAL_IDS)) {
    const color = TILE_COLORS[name as TileName];
    const tileLeft = localId * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const idx = (png.width * y + (tileLeft + x)) << 2;
        const shade = tileShade(name as TileName, x, y);
        png.data[idx] = Math.min(255, Math.round(color.r * shade));
        png.data[idx + 1] = Math.min(255, Math.round(color.g * shade));
        png.data[idx + 2] = Math.min(255, Math.round(color.b * shade));
        png.data[idx + 3] = 255;
      }
    }
  }

  return PNG.sync.write(png);
}

// --- Debug preview (not shipped — just so a human can eyeball the layout) ---

function buildDebugPreviewPng(grid: TileKind[][], spawns: Point[], pickups: Point[]): Buffer {
  const scale = 4;
  const png = new PNG({ width: MAP_WIDTH * scale, height: MAP_HEIGHT * scale });

  const paint = (tx: number, ty: number, r: number, g: number, b: number) => {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const px = tx * scale + dx;
        const py = ty * scale + dy;
        const idx = (png.width * py + px) << 2;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      }
    }
  };

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const kind = grid[y]![x]!;
      const color = kind === 'open' ? { r: 235, g: 235, b: 240 } : TILE_COLORS[kind];
      paint(x, y, color.r, color.g, color.b);
    }
  }

  const paintDot = (p: Point, r: number, g: number, b: number) => {
    const tx = Math.round(p.x / TILE_SIZE);
    const ty = Math.round(p.y / TILE_SIZE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        paint(tx + dx, ty + dy, r, g, b);
      }
    }
  };

  spawns.forEach((p) => paintDot(p, 0, 200, 0));
  pickups.forEach((p) => paintDot(p, 230, 180, 0));

  return PNG.sync.write(png);
}

// --- Main -----------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(here, { recursive: true });

const grid = buildGrid();
const { spawns, pickups } = generateSpawnsAndPickups(grid);
const mapJson = buildTiledJson(grid, spawns, pickups);

writeFileSync(join(here, 'catacombs.json'), JSON.stringify(mapJson, null, 2) + '\n');
writeFileSync(join(here, 'tileset.png'), buildTilesetPng());
writeFileSync(join(here, 'debug-preview.png'), buildDebugPreviewPng(grid, spawns, pickups));

console.log(`Generated catacombs.json: ${spawns.length} spawns, ${pickups.length} pickups.`);
