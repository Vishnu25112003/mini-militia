// Generates the original Catacombs-style map as a Tiled map (Phase 02):
//   shared/maps/catacombs.tmj   Tiled source file (open and edit it in Tiled)
//   shared/maps/catacombs.json  the same map exported as JSON (what the game loads)
//   shared/maps/tileset.png     placeholder 32 px tileset (plain colours)
//   shared/maps/catacombs.layout.txt  ASCII sketch of the layout
//
// Run:  npm run generate-map -w @game/shared
//
// The design is ORIGINAL: same structure and feel as the brief (octagon-like boundary, cave tunnels along the
// top and bottom, a grid of cross-shaped corridors, a central block, mirror symmetry) but its own shapes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const W = 100;
const H = 60;
const T = 32;

// tileset gids (firstgid = 1)
const GID = { wall: 1, platform: 2, background: 3, edge: 4 } as const;
const AIR = 0;
const WALL = 1;
const PLATFORM = 2;

const grid: number[][] = Array.from({ length: H }, () => Array<number>(W).fill(WALL));

// ---------- outer boundary: an octagon (corners cut at 45 degrees), 2 tiles of solid wall all round
function inOctagon(x: number, y: number): boolean {
  if (x < 2 || x > W - 3 || y < 2 || y > H - 3) return false;
  const cut = 12;
  const d1 = x - 2 + (y - 2);
  const d2 = W - 3 - x + (y - 2);
  const d3 = x - 2 + (H - 3 - y);
  const d4 = W - 3 - x + (H - 3 - y);
  return Math.min(d1, d2, d3, d4) >= cut;
}

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inOctagon(x, y)) grid[y][x] = AIR;

const fill = (x0: number, y0: number, x1: number, y1: number, v: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inOctagon(x, y)) grid[y][x] = v;
};
const solid = (x0: number, y0: number, x1: number, y1: number) => fill(x0, y0, x1, y1, WALL);
const air = (x0: number, y0: number, x1: number, y1: number) => fill(x0, y0, x1, y1, AIR);
const mirrorX = (x: number) => W - 1 - x;
const mirrorY = (y: number) => H - 1 - y;

// ---------- the cross-shaped corridor grid
// Vertical corridors (6 wide). Between them: block columns. Everything is mirror-symmetric about x = 49.5.
const SHAFTS: [number, number][] = [
  [2, 7],
  [22, 27],
  [40, 45],
  [54, 59],
  [72, 77],
  [92, 97],
];
const BLOCK_COLUMNS: [number, number][] = [
  [8, 21],
  [28, 39],
  [46, 53], // the central column
  [60, 71],
  [78, 91],
];
const BLOCK_ROWS: [number, number][] = [
  [18, 23],
  [36, 41],
];

// slabs separate the top / bottom cave tunnels (y 2-9 and 50-57) from the grid; shafts pierce them
for (const [y0, y1] of [
  [10, 11],
  [48, 49],
] as const) {
  solid(2, y0, W - 3, y1);
  for (const [a, b] of SHAFTS) air(a, y0, b, y1);
}
// block rows
for (const [y0, y1] of BLOCK_ROWS) for (const [x0, x1] of BLOCK_COLUMNS) solid(x0, y0, x1, y1);
// the central block, floating in the middle corridor between the two central column pieces
solid(46, 27, 53, 32);

// ---------- cave details: stalactites / stalagmites in the tunnels (all mirror-symmetric)
function stalactite(cx: number, top: number, down: boolean) {
  const rows = [5, 3, 1];
  rows.forEach((w, i) => {
    const y = down ? top + i : top - i;
    solid(cx - (w - 1) / 2, y, cx + (w - 1) / 2, y);
  });
}
for (const cx of [20, 44]) {
  for (const x of [cx, mirrorX(cx)]) {
    stalactite(x, 2, true); // hang from the top tunnel ceiling
    stalactite(x, H - 3, false); // rise from the bottom tunnel floor
  }
}
for (const cx of [14]) {
  for (const x of [cx, mirrorX(cx)]) {
    // small stalagmites on top of the top slab and hanging under the bottom slab
    solid(x - 1, 9, x + 1, 9);
    solid(x, 8, x, 8);
    solid(x - 1, 50, x + 1, 50);
    solid(x, 51, x, 51);
  }
}

// ---------- platforms (jetpack stepping stones and ledges)
// [x0, x1, y] for the top-left; each is mirrored left/right and top/bottom
const PLATFORMS: [number, number, number][] = [
  [28, 39, 27], // long platform in the middle corridor
  [22, 24, 21], // ledge on the left wall of a vertical corridor
  [40, 42, 21], // ledge on the left wall of the next corridor
  [30, 37, 6], // floating platform in the top tunnel
];
for (const [x0, x1, y] of PLATFORMS) {
  for (const yy of [y, mirrorY(y)]) {
    // ledges are anchored to the wall on the matching side
    fill(x0, yy, x1, yy, PLATFORM);
    fill(mirrorX(x1), yy, mirrorX(x0), yy, PLATFORM);
  }
}

// ---------- spawn points and pickup spots, placed on floors: [tileX, floorRow] for the left half, mirrored
const SPAWN_BASES: [number, number][] = [
  [34, 10], // top tunnel floor
  [12, 18], // top corridor, on a block
  [47, 18], // on the central column
  [29, 27], // on the long middle platform
  [12, 36], // middle corridor floor
  [34, 48], // bottom corridor
  [23, 21], // ledge in a vertical corridor
  [34, 58], // bottom tunnel floor
];
const PICKUP_BASES: [number, number][] = [
  [18, 10],
  [37, 18],
  [38, 27],
  [47, 27], // on top of the central block
  [20, 36],
  [10, 48],
  [26, 58], // bottom tunnel floor (clear of the stalagmites at x 18-22 and 42-46)
];

for (const [tx, fy] of [...SPAWN_BASES, ...PICKUP_BASES]) {
  if (grid[fy][tx] === AIR || grid[fy - 1][tx] !== AIR) {
    throw new Error(`base point (${tx}, ${fy}) is not standing on a floor`);
  }
}
const mirrored = (bases: [number, number][]) =>
  bases.flatMap(
    ([tx, fy]) =>
      [
        [tx, fy],
        [mirrorX(tx), fy],
      ] as [number, number][],
  );
// a spawn point is where the feet start: just above the floor. A pickup spot is the item's centre.
const spawnPoints = mirrored(SPAWN_BASES).map(([tx, fy]) => ({ x: tx * T + T / 2, y: fy * T - 2 }));
const pickupSpots = mirrored(PICKUP_BASES).map(([tx, fy]) => ({ x: tx * T + T / 2, y: fy * T - 16 }));

// ---------- tile layers
const isSolidKind = (k: number) => k === WALL || k === PLATFORM;
const collision: number[] = [];
const background: number[] = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const k = grid[y][x];
    background.push(GID.background);
    if (k === AIR) {
      collision.push(0);
    } else if (k === PLATFORM) {
      collision.push(GID.platform);
    } else {
      const nearAir = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny][nx] === AIR;
      });
      collision.push(nearAir ? GID.edge : GID.wall);
    }
    void isSolidKind;
  }
}

// ---------- Tiled map (JSON map format 1.10)
const tiledProp = (name: string, value: boolean) => ({ name, type: 'bool', value });
const mapJson = {
  compressionlevel: -1,
  height: H,
  infinite: false,
  layers: [
    {
      data: background,
      height: H,
      id: 1,
      name: 'background',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: W,
      x: 0,
      y: 0,
    },
    {
      data: collision,
      height: H,
      id: 2,
      name: 'collision',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: W,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 3,
      name: 'spawnPoints',
      objects: spawnPoints.map((p, i) => ({
        height: 0,
        id: i + 1,
        name: `spawn_${i + 1}`,
        point: true,
        rotation: 0,
        type: 'spawn',
        visible: true,
        width: 0,
        x: p.x,
        y: p.y,
      })),
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 4,
      name: 'pickupSpots',
      objects: pickupSpots.map((p, i) => ({
        height: 0,
        id: 100 + i + 1,
        name: `pickup_${i + 1}`,
        point: true,
        rotation: 0,
        type: 'pickup',
        visible: true,
        width: 0,
        x: p.x,
        y: p.y,
      })),
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
  ],
  nextlayerid: 5,
  nextobjectid: 200,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: T,
  tilesets: [
    {
      columns: 4,
      firstgid: 1,
      image: 'tileset.png',
      imageheight: T,
      imagewidth: T * 4,
      margin: 0,
      name: 'placeholder',
      spacing: 0,
      tilecount: 4,
      tileheight: T,
      tilewidth: T,
      tiles: [
        { id: 0, properties: [tiledProp('solid', true)] }, // wall
        { id: 1, properties: [tiledProp('solid', true)] }, // platform
        { id: 2, properties: [tiledProp('solid', false)] }, // background
        { id: 3, properties: [tiledProp('solid', true)] }, // cave edge
      ],
    },
  ],
  tilewidth: T,
  type: 'map',
  version: '1.10',
  width: W,
};

// ---------- placeholder tileset: plain colours, 4 tiles of 32 px
function tilesetPng(): Buffer {
  const png = new PNG({ width: T * 4, height: T });
  const put = (tile: number, x: number, y: number, [r, g, b]: [number, number, number]) => {
    const i = (y * png.width + tile * T + x) * 4;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  };
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const border = x < 2 || y < 2 || x >= T - 2 || y >= T - 2;
      put(0, x, y, border ? [0x7a, 0x62, 0x48] : [0x55, 0x45, 0x37]); // wall
      put(1, x, y, y < 6 ? [0xb0, 0x8a, 0x55] : border ? [0x6b, 0x4f, 0x2f] : [0x8a, 0x6a, 0x43]); // platform: lit top
      put(2, x, y, (x + y) % 11 === 0 ? [0x24, 0x1c, 0x30] : [0x1b, 0x14, 0x24]); // background
      put(3, x, y, y < 4 || x < 2 || x >= T - 2 ? [0xc9, 0xb2, 0x7a] : [0x6e, 0x58, 0x40]); // cave edge: light rim
    }
  }
  return PNG.sync.write(png);
}

// ---------- ASCII sketch (the "paper first" layout)
const marks = new Map<string, string>();
spawnPoints.forEach((p) => marks.set(`${Math.floor(p.x / T)},${Math.floor(p.y / T)}`, 'S'));
pickupSpots.forEach((p) => marks.set(`${Math.floor(p.x / T)},${Math.floor(p.y / T)}`, 'P'));
const sketch = [
  `Catacombs-style map, ${W} x ${H} tiles of ${T}px.  # wall   = platform   . air   S spawn (16)   P pickup (14)`,
  '',
  ...grid.map((row, y) =>
    row.map((k, x) => marks.get(`${x},${y}`) ?? (k === WALL ? '#' : k === PLATFORM ? '=' : '.')).join(''),
  ),
  '',
].join('\n');

// ---------- write everything
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..');
const json = JSON.stringify(mapJson);
fs.writeFileSync(path.join(out, 'catacombs.json'), json);
fs.writeFileSync(path.join(out, 'catacombs.tmj'), JSON.stringify(mapJson, null, 1));
fs.writeFileSync(path.join(out, 'tileset.png'), tilesetPng());
fs.writeFileSync(path.join(out, 'catacombs.layout.txt'), sketch);
console.log(
  `wrote catacombs.json / .tmj / tileset.png / layout.txt  (${spawnPoints.length} spawns, ${pickupSpots.length} pickups)`,
);
