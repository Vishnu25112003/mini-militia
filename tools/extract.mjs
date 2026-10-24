#!/usr/bin/env node
// Extracts the assets this rebuild needs from a Mini Militia Classic APK the user supplies.
// Nothing proprietary is committed to the repo; run `npm run extract -- <path/to.apk>`.
//
// Formats (reverse engineered from com.appsomniacs.mmc 0.14.4, cocos2d-x 2.2.6):
//   assets/hd/*.plist            TexturePacker format-3 atlases
//   assets/hd/11catacombs_new.tmx Tiled map, 55x35 tiles, base64 uint32 GIDs, layers tilebg (decor) + tile (solid)
//   assets/hd/tile64Desert_new.png 128px tiles, margin 4, spacing 4 (64 world points per tile)
//   assets/da2sound16.ckb        Cricket Audio bank: 0x48 header, 72-byte entries, PCM16 mono data packed after the table
//   assets/hd/font02_new.png     16x16 grid bitmap font, ASCII from 0x20

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'assets');
const apkPath = process.argv[2] || path.join(os.homedir(), 'Downloads', 'com.appsomniacs.mmc_0.14.4.apk');

if (!fs.existsSync(apkPath)) {
  console.error(`APK not found: ${apkPath}\nUsage: npm run extract -- /path/to/com.appsomniacs.mmc.apk`);
  process.exit(1);
}

const zip = new AdmZip(apkPath);
const entry = (name) => {
  const e = zip.getEntry(name);
  if (!e) throw new Error(`missing ${name} in APK`);
  return e.getData();
};
const write = (rel, data) => {
  const p = path.join(out, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
};

// ---------- texture atlases ----------
function parsePlist(xml) {
  // Minimal plist reader for TexturePacker output.
  const tokens = xml.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '').match(/<[^>]+>|[^<]+/g).map((t) => t.trim()).filter(Boolean);
  let i = 0;
  const parse = () => {
    const t = tokens[i++];
    if (t === '<plist version="1.0">') return parse();
    if (t === '<dict>') {
      const o = {};
      while (tokens[i] !== '</dict>') {
        i++; // <key>
        const k = tokens[i++];
        i++; // </key>
        o[k] = parse();
      }
      i++;
      return o;
    }
    if (t === '<dict/>') return {};
    if (t === '<array>') {
      const a = [];
      while (tokens[i] !== '</array>') a.push(parse());
      i++;
      return a;
    }
    if (t === '<array/>') return [];
    if (t === '<true/>') return true;
    if (t === '<false/>') return false;
    if (t === '<string>' || t === '<integer>' || t === '<real>') {
      let v = tokens[i] === '</string>' ? '' : tokens[i++];
      i++;
      return t === '<string>' ? v : Number(v);
    }
    throw new Error(`plist token ${t}`);
  };
  return parse();
}

const nums = (s) => s.match(/-?\d+(\.\d+)?/g).map(Number);

function atlas(name) {
  const plist = parsePlist(entry(`assets/hd/${name}.plist`).toString('utf8'));
  const frames = {};
  for (const [key, f] of Object.entries(plist.frames)) {
    const [x, y, w, h] = nums(f.textureRect);
    const [ox, oy] = nums(f.spriteOffset);
    const [sw, sh] = nums(f.spriteSourceSize);
    frames[key.replace(/\.(png|PNG)$/, '')] = { x, y, w, h, r: f.textureRotated ? 1 : 0, ox, oy, sw, sh };
  }
  write(`atlas/${name}.png`, entry(`assets/hd/${name}.png`));
  write(`atlas/${name}.json`, JSON.stringify({ image: `${name}.png`, frames }));
  console.log(`atlas ${name}: ${Object.keys(frames).length} frames`);
}
const only = process.argv[3]; // e.g. `font` to rebuild just the font
if (!only) {
atlas('menuTexture');
atlas('partsTexture');

// ---------- plain images ----------
const images = [
  'tile64Desert_new', 'bgDesert_new', 'title_ret_new', 'title_ret_logo', 'classic', 'dialog',
  'blast_new', 'blasticle_new', 'blood_new', 'bullet_new', 'shell_new', 'shrap_new', 'smoke_new',
  'smokey_new', 'spark_new', 'splatter_new', 'streak_new', 'rock_new', 'nameplate1', 'nameplate2', 'nameplate3', 'ammoText_new', 'ora_new',
];
for (const img of images) write(`img/${img}.png`, entry(`assets/hd/${img}.png`));
console.log(`images: ${images.length}`);

// ---------- map + collision ----------
}
if (!only || only === 'map') {
  const xml = entry('assets/hd/11catacombs_new.tmx').toString('utf8');
  const W = +xml.match(/<map[^>]* width="(\d+)"/)[1];
  const H = +xml.match(/<map[^>]* height="(\d+)"/)[1];
  const layers = {};
  for (const m of xml.matchAll(/<layer name="(\w+)"[\s\S]*?<data encoding="base64">\s*([A-Za-z0-9+/=\s]+?)\s*<\/data>/g)) {
    const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
    const gids = [];
    for (let i = 0; i < W * H; i++) gids.push(buf.readUInt32LE(i * 4) & 0x1fffffff);
    layers[m[1]] = gids;
  }
  const objects = [];
  for (const m of xml.matchAll(/<object id="\d+" name="(\w+)" x="([\d.]+)" y="([\d.]+)"(\/>|>([\s\S]*?)<\/object>)/g)) {
    const props = {};
    for (const p of (m[5] || '').matchAll(/<property name="(\w+)" value="([^"]*)"/g)) props[p[1]] = p[2];
    objects.push({ name: m[1], x: +m[2], y: +m[3], ...props });
  }

  // Tileset: 128px tiles, margin 4, spacing 4, drawn at 64 world points.
  const ts = PNG.sync.read(entry('assets/hd/tile64Desert_new.png'));
  const cols = Math.floor((ts.width - 4) / 132);
  // [RE] Collision follows the original: MapFactory::addStaticBodyShape looks each `tile` gid up in
  // MapShapeFactory's gid -> MapShapeType table and builds that type's Chipmunk polygons
  // (tools/mmc-shapes.json, captured from the APK). A gid missing from the table has no collision.
  const shapes = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'mmc-shapes.json'), 'utf8'));
  const CELL = 4; // world points per collision cell
  const sub = 64 / CELL; // cells per tile edge
  const gw = W * sub, gh = H * sub;
  const solid = new Uint8Array(gw * gh);
  const inside = (poly, x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const unknown = new Set();
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const gid = layers.tile[ty * W + tx];
      if (!gid) continue;
      const type = shapes.tileToShape[gid];
      if (type === undefined) { unknown.add(gid); continue; }
      const polys = shapes.shapes[type] || [];
      for (let cy = 0; cy < sub; cy++) {
        for (let cx = 0; cx < sub; cx++) {
          const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL;
          if (polys.some((p) => inside(p, x, y))) solid[(ty * sub + cy) * gw + tx * sub + cx] = 1;
        }
      }
    }
  }
  if (unknown.size) console.log(`map: no collision shape for tile gids ${[...unknown].sort((a, b) => a - b).join(', ')}`);
  const bits = Buffer.alloc(Math.ceil(gw * gh / 8));
  solid.forEach((v, i) => { if (v) bits[i >> 3] |= 1 << (i & 7); });
  write('map/catacombs.json', JSON.stringify({
    name: 'Catacombs', width: W, height: H, tile: 64, tileset: { image: 'tile64Desert_new.png', size: 128, margin: 4, spacing: 4, cols },
    background: 'bgDesert_new.png', layers, objects,
    collision: { cell: CELL, cols: gw, rows: gh, bits: bits.toString('base64') },
  }));
  console.log(`map catacombs: ${W}x${H}, ${objects.length} objects, collision ${gw}x${gh}`);
  if (only) write('img/ora_new.png', entry('assets/hd/ora_new.png'));
}

// ---------- sounds (Cricket Audio .ckb) ----------
if (!only) {
  const d = entry('assets/da2sound16.ckb');
  if (d.toString('latin1', 0, 4) !== 'ckmk') throw new Error('unexpected sound bank magic');
  const n = d.readUInt32LE(0x38);
  let off = 0x48 + n * 72;
  const names = [];
  for (let i = 0; i < n; i++) {
    const e = 0x48 + i * 72;
    const name = d.toString('latin1', e, e + 32).replace(/\0.*$/s, '').replace(/\.wav$/, '');
    const rate = d.readUInt16LE(e + 34);
    const bytes = d.readUInt32LE(e + 32 + 0x1c);
    const pcm = d.subarray(off, off + bytes);
    off += bytes;
    const hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + bytes, 4); hdr.write('WAVEfmt ', 8);
    hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
    hdr.writeUInt32LE(rate, 24); hdr.writeUInt32LE(rate * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
    hdr.write('data', 36); hdr.writeUInt32LE(bytes, 40);
    write(`sfx/${name}.wav`, Buffer.concat([hdr, pcm]));
    names.push(name);
  }
  if (off !== d.length) throw new Error(`sound bank size mismatch ${off} != ${d.length}`);
  write('sfx/index.json', JSON.stringify(names));
  console.log(`sounds: ${n}`);
}

// ---------- bitmap font -> OpenType ----------
// UI faces shipped in the APK: Bebas Neue (headings, buttons, numbers) and Dosis Bold (body)
if (!only || only === 'font') {
  for (const f of ['BebasNeueBold.ttf', 'Dosis-Bold.ttf']) write(`font/${f}`, entry(`assets/fonts/${f}`));
}
if (!only || only === 'font') {
  const png = PNG.sync.read(entry('assets/hd/font02_new.png'));
  const cellPx = png.width / 16;
  const U = 32; // font units per source pixel
  const unitsPerEm = cellPx * U;
  const glyphs = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: unitsPerEm / 2, path: new opentype.Path() })];
  // Baseline: bottom of capital "A" in its cell.
  const on = (x, y) => png.data[(y * png.width + x) * 4 + 3] > 127;
  const cellOf = (code) => [((code - 32) % 16) * cellPx, Math.floor((code - 32) / 16) * cellPx];
  let base = 0;
  { const [cx, cy] = cellOf(65); for (let y = 0; y < cellPx; y++) for (let x = 0; x < cellPx; x++) if (on(cx + x, cy + y)) base = Math.max(base, y + 1); }
  // Glyphs the original sheet lacks, drawn on its own 8px block grid (5 blocks tall, like the capitals).
  const EXTRA = {
    37: ['##..#', '##.#.', '..#..', '.#.##', '#..##'], // %
    38: ['.##..', '#..#.', '.##.#', '#..#.', '.##.#'], // &
    0x2212: ['.....', '.....', '#####', '.....', '.....'], // minus sign
  };
  const blockGlyph = (rows) => {
    const p = new opentype.Path();
    const B = 8, top0 = base - 5 * B;
    rows.forEach((row, r) => [...row].forEach((c, k) => {
      if (c !== '#') return;
      const x0 = k * B * U, x1 = (k + 1) * B * U, t = (base - (top0 + r * B)) * U, b = (base - (top0 + (r + 1) * B)) * U;
      p.moveTo(x0, t); p.lineTo(x0, b); p.lineTo(x1, b); p.lineTo(x1, t); p.close();
    }));
    return { path: p, advance: (5 * B + 3) * U };
  };
  for (let code = 32; code < 127; code++) {
    if (EXTRA[code]) {
      const g = blockGlyph(EXTRA[code]);
      glyphs.push(new opentype.Glyph({ name: `g${code}`, unicode: code, advanceWidth: g.advance, path: g.path }));
      continue;
    }
    const [cx, cy] = cellOf(code);
    let minX = cellPx, maxX = -1;
    const p = new opentype.Path();
    for (let y = 0; y < cellPx; y++) {
      let x = 0;
      while (x < cellPx) {
        if (!on(cx + x, cy + y)) { x++; continue; }
        const x0 = x;
        while (x < cellPx && on(cx + x, cy + y)) x++;
        minX = Math.min(minX, x0); maxX = Math.max(maxX, x - 1);
        const top = (base - y) * U, bottom = (base - y - 1) * U;
        p.moveTo(x0 * U, top); p.lineTo(x0 * U, bottom); p.lineTo(x * U, bottom); p.lineTo(x * U, top); p.close();
      }
    }
    let advance;
    if (maxX < 0) { advance = Math.round(cellPx * 0.45) * U; }
    else {
      // shift glyph so its ink starts at 0, then add a two-pixel gap
      for (const c of p.commands) { if ('x' in c) c.x -= minX * U; }
      advance = (maxX - minX + 1 + 3) * U;
    }
    glyphs.push(new opentype.Glyph({ name: `g${code}`, unicode: code, advanceWidth: advance, path: p }));
  }
  { const g = blockGlyph(EXTRA[0x2212]); glyphs.push(new opentype.Glyph({ name: 'uni2212', unicode: 0x2212, advanceWidth: g.advance, path: g.path })); }
  const font = new opentype.Font({
    familyName: 'Militia', styleName: 'Regular', unitsPerEm,
    ascender: base * U + U * 2, descender: -(cellPx - base) * U, glyphs,
  });
  write('font/militia.otf', Buffer.from(font.toArrayBuffer()));
  console.log(`font: ${glyphs.length} glyphs`);
}

console.log(`\nAssets written to ${path.relative(process.cwd(), out)}/`);
