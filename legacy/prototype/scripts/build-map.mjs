// Derives numeric level data (collision grid, spawns, pickups, flag stations) for the Catacombs map
// from an extracted Mini Militia APK. Only geometry is written out; no art or audio is copied.
//
// usage: node scripts/build-map.mjs <extracted-apk-dir> [mapFile=11catacombs_new.tmx] [out=src/game/maps/catacombs.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const apk = process.argv[2];
if (!apk) {
  console.error('usage: node scripts/build-map.mjs <extracted-apk-dir> [map.tmx] [out.json]');
  process.exit(1);
}
const mapFile = process.argv[3] ?? '11catacombs_new.tmx';
const outFile = process.argv[4] ?? 'src/game/maps/catacombs.json';
const sd = path.join(apk, 'assets', 'sd');

const xml = fs.readFileSync(path.join(sd, mapFile), 'utf8');
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const props = (s) => Object.fromEntries([...s.matchAll(/<property\s+([^>]*?)\/?>/g)].map((m) => { const a = attrs(m[1]); return [a.name, a.value]; }));

const mapTag = attrs(xml.match(/<map\s+([^>]*)>/)[1]);
const W = +mapTag.width, H = +mapTag.height, T = +mapTag.tilewidth;

// tileset: single 64px grid image with margin/spacing
const tsxName = attrs(xml.match(/<tileset\s+([^>]*)\/?>/)[1]).source;
const tsx = fs.readFileSync(path.join(sd, tsxName), 'utf8');
const tsAttrs = attrs(tsx.match(/<tileset\s+([^>]*)>/)[1]);
const margin = +tsAttrs.margin, spacing = +tsAttrs.spacing;
const img = PNG.sync.read(fs.readFileSync(path.join(sd, attrs(tsx.match(/<image\s+([^>]*)\/?>/)[1]).source)));
const cols = Math.floor((img.width - margin * 2 + spacing) / (T + spacing));

const CELL = 8;
const N = T / CELL;
const maskCache = new Map();
function tileMask(gid) {
  if (maskCache.has(gid)) return maskCache.get(gid);
  const idx = gid - 1;
  const ox = margin + (idx % cols) * (T + spacing);
  const oy = margin + Math.floor(idx / cols) * (T + spacing);
  const m = new Uint8Array(N * N);
  for (let cy = 0; cy < N; cy++) {
    for (let cx = 0; cx < N; cx++) {
      let on = 0;
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
        const px = ox + cx * CELL + x, py = oy + cy * CELL + y;
        if (img.data[(py * img.width + px) * 4 + 3] > 128) on++;
      }
      m[cy * N + cx] = on >= (CELL * CELL) / 2 ? 1 : 0;
    }
  }
  maskCache.set(gid, m);
  return m;
}

function layerGrid(name) {
  const m = xml.match(new RegExp(`<layer\\s+name="${name}"[^>]*>([\\s\\S]*?)</layer>`));
  const d = m[1].match(/<data\s+([^>]*)>([\s\S]*?)<\/data>/);
  let raw = Buffer.from(d[2].replace(/\s+/g, ''), 'base64');
  if (attrs(d[1]).compression === 'zlib') raw = zlib.inflateSync(raw);
  const gw = W * N, gh = H * N;
  const grid = Array.from({ length: gh }, () => new Uint8Array(gw));
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const gid = raw.readUInt32LE((ty * W + tx) * 4) & 0x1fffffff;
    if (!gid) continue;
    const mk = tileMask(gid);
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) grid[ty * N + cy][tx * N + cx] = mk[cy * N + cx];
  }
  return grid.map((r) => Array.from(r).join(''));
}

const objs = [...xml.matchAll(/<object\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/object>)/g)].map((o) => {
  const a = attrs(o[1]);
  return { name: a.name, x: Math.round(+a.x), y: Math.round(+a.y), props: props(o[2] ?? '') };
});

const out = {
  name: 'Catacombs',
  cell: CELL,
  cols: W * N,
  rows: H * N,
  solid: layerGrid('tile'),
  back: layerGrid('tilebg'),
  spawns: objs.filter((o) => /^sp_p_/.test(o.name)).map(({ x, y }) => ({ x, y })),
  ctfSpawns: objs.filter((o) => /^ctf_sp_/.test(o.name)).map(({ name, x, y }) => ({ team: +name.slice(-1), x, y })),
  pickups: objs.filter((o) => /^(wp_p_|ctf_wp_)/.test(o.name)).map(({ name, x, y, props: p }) => ({ id: name, x, y, pool: p.weapon.split(',') })),
  flags: objs.filter((o) => /^fp_\d$/.test(o.name)).map(({ name, x, y }) => ({ team: +name.slice(-1), x, y })),
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
const solidCells = out.solid.reduce((n, r) => n + [...r].filter((c) => c === '1').length, 0);
console.log(`wrote ${outFile}: ${out.cols}x${out.rows} cells, ${solidCells} solid, ${out.spawns.length} spawns, ${out.pickups.length} pickups, ${out.flags.length} flags`);
