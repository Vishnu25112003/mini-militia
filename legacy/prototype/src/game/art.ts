// Original, procedurally drawn art: terrain, sky and weapons. Nothing here is sampled from any game's
// assets; the palette and proportions follow numbers measured from the Android build (warm khaki stone,
// sand highlights, near-black outlines, ~1.1 tile tall soldiers).
import { MAP } from './map';
import type { WeaponId } from './types';

export const OUT = '#14100a';

const rngFrom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------- terrain
const W = MAP.width, H = MAP.height, S = MAP.cell, C = MAP.cols, R = MAP.rows;

/** 3x3 box blur, merged with the raw mask so thin ledges never vanish. */
function smoothField(grid: Uint8Array): Float32Array {
  const out = new Float32Array(C * R);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.min(C - 1, Math.max(0, x + dx)), yy = Math.min(R - 1, Math.max(0, y + dy));
      sum += grid[yy * C + xx];
    }
    out[y * C + x] = Math.max(sum / 9, grid[y * C + x] * 0.62);
  }
  return out;
}

/** Repeated box blur: value approaches 1 only deep inside large solid masses. */
function depthField(grid: Uint8Array, passes: number): Float32Array {
  let a = Float32Array.from(grid);
  let b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        sum += a[Math.min(R - 1, Math.max(0, y + dy)) * C + Math.min(C - 1, Math.max(0, x + dx))];
      }
      b[y * C + x] = sum / 9;
    }
    [a, b] = [b, a];
  }
  return a;
}

/** Bilinear upsample of the field to full resolution, thresholded into an anti-aliased alpha mask. */
function thresholdMask(field: Float32Array, thr: number, k = 14): Uint8Array {
  const out = new Uint8Array(W * H);
  const x0 = new Int32Array(W), x1 = new Int32Array(W), tx = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const fx = (x + 0.5) / S - 0.5, i0 = Math.floor(fx);
    x0[x] = Math.min(C - 1, Math.max(0, i0)); x1[x] = Math.min(C - 1, Math.max(0, i0 + 1)); tx[x] = fx - i0;
  }
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) / S - 0.5, j0 = Math.floor(fy), ty = fy - j0;
    const r0 = Math.min(R - 1, Math.max(0, j0)) * C, r1 = Math.min(R - 1, Math.max(0, j0 + 1)) * C;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const a = x0[x], b = x1[x], t = tx[x];
      const v = (field[r0 + a] * (1 - t) + field[r0 + b] * t) * (1 - ty) + (field[r1 + a] * (1 - t) + field[r1 + b] * t) * ty;
      const al = (v - thr) * k + 0.5;
      out[row + x] = al <= 0 ? 0 : al >= 1 ? 255 : (al * 255) | 0;
    }
  }
  return out;
}

/**
 * base * (1 - base shifted down by dy(x)): a band along upward-facing edges (dy > 0) or downward-facing
 * edges (dy < 0). A per-column dy gives the band a wavy, hand-drawn lower edge.
 */
function edgeBand(base: Uint8Array, dyAt: (x: number) => number): Uint8Array {
  const out = new Uint8Array(W * H);
  const dys = new Int32Array(W);
  for (let x = 0; x < W; x++) dys[x] = Math.round(dyAt(x));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dy = dys[x];
      const sy = y - dy;
      const other = sy >= 0 && sy < H ? base[sy * W + x] : dy < 0 ? 255 : 0;
      out[y * W + x] = (base[y * W + x] * (255 - other)) / 255;
    }
  }
  return out;
}

function maskCanvas(alpha: Uint8Array): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i];
  g.putImageData(img, 0, 0);
  return c;
}

interface StoneStyle { base: string; dark: string; light: string; pebbleFill: string; pebbleLine: string; blockLine: string; seed: number; blocks: number }

function stonePattern(s: StoneStyle): HTMLCanvasElement {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d')!;
  const rnd = rngFrom(s.seed);
  g.fillStyle = s.base; g.fillRect(0, 0, N, N);
  const wrap = (fn: (ox: number, oy: number) => void) => { for (let oy = -N; oy <= N; oy += N) for (let ox = -N; ox <= N; ox += N) fn(ox, oy); };

  // soft tonal blotches
  for (let i = 0; i < 70; i++) {
    const x = rnd() * N, y = rnd() * N, r = 8 + rnd() * 34;
    const col = rnd() < 0.55 ? s.dark : s.light;
    wrap((ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, col + '38'); gr.addColorStop(1, col + '00');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }

  // staggered stone courses: four rows that tile seamlessly, each row cut into blocks of random width
  const rowH = N / 4;
  for (let r = 0; r < 4; r++) {
    const cuts: number[] = [];
    let pos = rnd() * 40;
    while (pos < N) { cuts.push(pos); pos += 46 + rnd() * 52; }
    cuts.forEach((x, i) => {
      const next = i + 1 < cuts.length ? cuts[i + 1] : cuts[0] + N;
      const w = next - x - 4, y = r * rowH + 2, h = rowH - 4;
      const tone = rnd();
      wrap((ox, oy) => {
        if (ox !== 0 && ox !== -N && ox !== N) return;
        g.beginPath(); g.roundRect(x + ox + 2, y + oy, w, h, 11);
        g.fillStyle = tone < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'; g.fill();
        g.lineWidth = 2.6; g.strokeStyle = s.blockLine; g.stroke();
        g.beginPath(); g.moveTo(x + ox + 12, y + oy + 3.5); g.lineTo(x + ox + w - 8, y + oy + 3.5);
        g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke();
        g.beginPath(); g.moveTo(x + ox + 10, y + oy + h - 2.5); g.lineTo(x + ox + w - 6, y + oy + h - 2.5);
        g.lineWidth = 2.2; g.strokeStyle = 'rgba(0,0,0,0.14)'; g.stroke();
      });
    });
  }

  // embedded pebbles: a few, in varied sizes and tones, so they read as stones rather than speckle
  g.lineWidth = 1.8; g.strokeStyle = s.pebbleLine;
  for (let i = 0; i < 9; i++) {
    const x = rnd() * N, y = rnd() * N, big = rnd() < 0.3;
    const rx = (big ? 11 : 5) + rnd() * (big ? 6 : 5), ry = rx * (0.55 + rnd() * 0.25), rot = (rnd() - 0.5) * 0.7;
    const dark = rnd() < 0.35;
    wrap((ox, oy) => {
      g.fillStyle = dark ? s.dark : s.pebbleFill;
      g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(x + ox - rx * 0.28, y + oy - ry * 0.32, rx * 0.42, ry * 0.3, rot, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.32)'; g.fill();
    });
  }

  // hairline cracks
  g.strokeStyle = s.pebbleLine + '88'; g.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const x = rnd() * N, y = rnd() * N, l = 10 + rnd() * 18, a = rnd() * Math.PI;
    wrap((ox, oy) => {
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * l * 0.5, y + oy + Math.sin(a) * l * 0.25);
      g.lineTo(x + ox + Math.cos(a + 0.5) * l, y + oy + Math.sin(a + 0.5) * l * 0.5);
      g.stroke();
    });
  }
  return c;
}

export function bakeTerrain(): HTMLCanvasElement {
  const T = document.createElement('canvas');
  T.width = W; T.height = H;
  const g = T.getContext('2d')!;
  const layer = document.createElement('canvas');
  layer.width = W; layer.height = H;
  const lg = layer.getContext('2d')!;

  const paint = (alpha: Uint8Array, fill: string | CanvasPattern, opacity = 1) => {
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, W, H);
    lg.fillStyle = fill; lg.fillRect(0, 0, W, H);
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(maskCanvas(alpha), 0, 0);
    g.globalAlpha = opacity;
    g.drawImage(layer, 0, 0);
    g.globalAlpha = 1;
  };
  const pat = (s: StoneStyle) => g.createPattern(stonePattern(s), 'repeat')!;

  // back wall: translucent so the parallax sky faintly shows through
  const backField = smoothField(MAP.back);
  paint(thresholdMask(backField, 0.35), '#2b2113', 0.94);
  paint(thresholdMask(backField, 0.5), pat({ base: '#6a583c', dark: '#4c3d27', light: '#7e6a4a', pebbleFill: '#85704f', pebbleLine: '#2c2012', blockLine: 'rgba(30,20,8,0.35)', seed: 7, blocks: 7 }), 0.9);

  // solid ground
  const solidField = smoothField(MAP.solid);
  const fill = thresholdMask(solidField, 0.5);
  paint(thresholdMask(solidField, 0.34), OUT);
  paint(fill, pat({ base: '#988868', dark: '#786848', light: '#b8a878', pebbleFill: '#d8c8a8', pebbleLine: '#3a2c18', blockLine: 'rgba(52,38,18,0.34)', seed: 21, blocks: 8 }));
  // crisp inner edge: a darker band just inside the outline gives the rock a bevelled, hand-inked look
  const shrunk = thresholdMask(solidField, 0.66, 14);
  const ring = new Uint8Array(fill.length);
  for (let i = 0; i < ring.length; i++) ring[i] = Math.max(0, fill[i] - shrunk[i]);
  paint(ring, 'rgba(66,48,22,0.46)');
  // deep inside large masses the rock darkens, giving the cave some depth
  paint(thresholdMask(depthField(MAP.solid, 5), 0.8, 7), 'rgba(48,32,14,0.2)');
  // shade under overhangs
  paint(edgeBand(fill, () => -11), 'rgba(40,28,12,0.34)');
  // sand-lit tops with a wavy lower edge, plus a brighter crest line
  const wave = (x: number) => 12 + 4.4 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.13 + 1.7) + 1.6 * Math.sin(x * 0.31) + 1.2 * Math.sin(x * 0.7);
  paint(edgeBand(fill, wave), '#e4d29c');
  paint(edgeBand(fill, (x) => wave(x) * 0.55), '#f4e8bd');
  paint(edgeBand(fill, (x) => wave(x) * 0.22), '#fff8dc', 0.85);
  return T;
}

// ---------------------------------------------------------------- sky
function dunes(width: number, height: number, seed: number, color: string, rim: string, rough: number, strata: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d')!;
  const rnd = rngFrom(seed);
  const waves = Array.from({ length: 6 }, (_, i) => ({ k: 1 + i * 2 + Math.floor(rnd() * 2), a: (1 / (1 + i * 0.9)) * rough, p: rnd() * Math.PI * 2 }));
  const mesas = [rnd() * width, rnd() * width];
  const mesaW = width * (0.04 + rnd() * 0.04);
  const heightAt = (x: number) => {
    let h = 0;
    for (const w of waves) h += w.a * Math.sin((2 * Math.PI * w.k * x) / width + w.p);
    let y = height * 0.5 - h * height * 0.22;
    for (const m of mesas) {
      const d = Math.min(Math.abs(x - m), Math.abs(x - m + width), Math.abs(x - m - width));
      if (d < mesaW) y = Math.min(y, height * 0.2 + (d / mesaW) ** 3 * height * 0.3);
    }
    return y;
  };
  g.beginPath(); g.moveTo(0, height);
  for (let x = 0; x <= width; x += 5) g.lineTo(x, heightAt(x));
  g.lineTo(width, height); g.closePath();
  g.fillStyle = color; g.fill();
  if (strata) {
    g.save(); g.clip();
    // sparse, broken rock strata rather than ruled lines
    g.strokeStyle = 'rgba(120,88,40,0.11)'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let y = height * 0.3; y < height; y += 22 + rnd() * 14) {
      let x = rnd() * 120;
      while (x < width) {
        const seg = 60 + rnd() * 220;
        g.beginPath(); g.moveTo(x, y + (rnd() - 0.5) * 4); g.lineTo(x + seg, y + (rnd() - 0.5) * 4); g.stroke();
        x += seg + 40 + rnd() * 160;
      }
    }
    g.restore();
  }
  g.beginPath();
  for (let x = 0; x <= width; x += 5) { const y = heightAt(x); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.strokeStyle = rim; g.lineWidth = 3; g.stroke();
  return c;
}

function cloudSprite(seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 420; c.height = 150;
  const g = c.getContext('2d')!;
  const rnd = rngFrom(seed);
  const blobs: { x: number; y: number; r: number }[] = [];
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    blobs.push({ x: 60 + t * 300, y: 92 - Math.sin(t * Math.PI) * (28 + rnd() * 14), r: 26 + Math.sin(t * Math.PI) * 24 + rnd() * 10 });
  }
  g.fillStyle = '#fffaf0';
  for (const b of blobs) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.roundRect(50, 88, 320, 34, 16); g.fill();
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 40, 0, 125);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(240,224,180,0)'); gr.addColorStop(1, 'rgba(226,200,150,0.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 420, 150);
  return c;
}

export class Sky {
  private layers = [
    { img: dunes(2400, 420, 3, '#f0dfaa', '#fbf1cc', 0.7, true), color: '#f0dfaa', f: 0.05, y: 0.5 },
    { img: dunes(2400, 420, 11, '#e3ca8f', '#f2dfaa', 0.9, true), color: '#e3ca8f', f: 0.11, y: 0.61 },
    { img: dunes(2400, 420, 29, '#d3b676', '#e6d097', 1.1, false), color: '#d3b676', f: 0.2, y: 0.74 },
  ];
  private clouds = [cloudSprite(5), cloudSprite(9), cloudSprite(14), cloudSprite(23)];

  draw(g: CanvasRenderingContext2D, w: number, h: number, camX: number, camY: number, zoom: number, t = 0) {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#fcf3d0'); sky.addColorStop(0.5, '#f4e3ac'); sky.addColorStop(1, '#dcc07e');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);

    // sun with slowly turning rays
    const sx = w * 0.78, sy = h * 0.2;
    g.save();
    g.translate(sx, sy);
    g.rotate(t * 0.02);
    for (let i = 0; i < 14; i++) {
      g.rotate((Math.PI * 2) / 14);
      const grd = g.createLinearGradient(0, 0, h * 0.55, 0);
      grd.addColorStop(0, 'rgba(255,250,215,0.38)'); grd.addColorStop(1, 'rgba(255,250,215,0)');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(h * 0.55, -h * 0.035); g.lineTo(h * 0.55, h * 0.035); g.closePath(); g.fill();
    }
    g.restore();
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.3);
    sg.addColorStop(0, 'rgba(255,253,235,1)'); sg.addColorStop(0.18, 'rgba(255,248,205,0.95)'); sg.addColorStop(1, 'rgba(255,250,215,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);

    // drifting clouds in two parallax depths
    for (let layer = 0; layer < 2; layer++) {
      const f = layer ? 0.14 : 0.08, speed = layer ? 14 : 8, scale = (layer ? 0.5 : 0.36) * zoom * 1.1;
      const spacing = (layer ? 760 : 980) * zoom * 0.7;
      const base = (t * speed * zoom) + camX * f * zoom;
      for (let i = -1; i < Math.ceil(w / spacing) + 2; i++) {
        const k = i + Math.floor(base / spacing);
        const x = k * spacing - base;
        const spr = this.clouds[(Math.abs(k) * 3 + layer * 2) % this.clouds.length];
        const y = h * (layer ? 0.2 : 0.12) + ((Math.abs(k * 37 + layer * 11) % 7) / 7) * h * 0.14 - (camY - MAP.height / 2) * f * 0.2 * zoom;
        g.globalAlpha = layer ? 0.95 : 0.7;
        g.drawImage(spr, x, y, spr.width * scale, spr.height * scale);
      }
    }
    g.globalAlpha = 1;

    for (const l of this.layers) {
      const sw = l.img.width * zoom * 0.55, sh = l.img.height * zoom * 0.55;
      const off = -((camX * l.f * zoom) % sw);
      const y = h * l.y - (camY - MAP.height / 2) * l.f * zoom * 0.4;
      for (let x = off - sw; x < w + sw; x += sw) g.drawImage(l.img, x, y - sh * 0.5, sw + 1, sh);
      // continue the layer's colour to the bottom of the screen so no seam shows under the strip
      g.fillStyle = l.color;
      g.fillRect(0, y + sh * 0.5 - 1, w, h);
    }
    // warm haze at the horizon
    const haze = g.createLinearGradient(0, h * 0.6, 0, h);
    haze.addColorStop(0, 'rgba(245,225,160,0)'); haze.addColorStop(1, 'rgba(235,205,140,0.5)');
    g.fillStyle = haze; g.fillRect(0, h * 0.6, w, h * 0.4);
  }
}

// ---------------------------------------------------------------- weapons
const METAL = '#8a909a', DARK = '#3b4048', WOOD = '#9a6a35', GREEN = '#5a7344';

function shape(g: CanvasRenderingContext2D, fill: string, path: () => void, line = 2.2) {
  g.beginPath(); path();
  g.fillStyle = fill; g.fill();
  g.lineWidth = line; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
}

/** Rounded part with a glossy top highlight, shaded underside, and grain on wooden parts. */
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) => {
  shape(g, fill, () => g.roundRect(x, y, w, h, r));
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.26)'; g.fillRect(x, y, w, Math.max(1.5, h * 0.34));
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y + h * 0.72, w, h * 0.28);
  if (fill === WOOD && w > 12) {
    g.strokeStyle = 'rgba(70,40,12,0.45)'; g.lineWidth = 1;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x + 2, y + (h * i) / 3); g.lineTo(x + w - 2, y + (h * i) / 3 + 1.2); g.stroke(); }
  }
  g.restore();
};

const tick = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c = 'rgba(20,16,10,0.55)') => { g.fillStyle = c; g.fillRect(x, y, w, h); };

/** Draws a gun with its grip at the origin, pointing along +x. `len` is the barrel-end distance. */
export function drawGun(g: CanvasRenderingContext2D, id: WeaponId, len: number, accent: string) {
  g.save();
  switch (id) {
    case 'magnum':
      rr(g, -4, -8, len * 0.86, 10, 3, METAL);
      tick(g, len * 0.2, -6, 2, 6); tick(g, len * 0.26, -6, 2, 6); tick(g, len * 0.32, -6, 2, 6);
      rr(g, -6, 1, 11, 16, 3, DARK);
      shape(g, DARK, () => { g.moveTo(5, 2); g.quadraticCurveTo(14, 2, 14, 9); g.lineTo(11, 9); g.quadraticCurveTo(11, 5, 5, 5); g.closePath(); }, 1.8);
      rr(g, len * 0.58, -11, 5, 4, 1, DARK);
      rr(g, len * 0.82, -7, 5, 6, 1, DARK);
      break;
    case 'uzi': case 'mp5':
      if (id === 'mp5') { rr(g, -len * 0.3, -6, len * 0.3, 6, 2, DARK); rr(g, -len * 0.33, -8, 6, 11, 2, METAL); }
      rr(g, -7, -9, len * 0.72, 12, 3, DARK);
      tick(g, len * 0.2, -6, 3, 6, 'rgba(255,255,255,0.18)'); tick(g, len * 0.28, -6, 3, 6, 'rgba(255,255,255,0.18)'); tick(g, len * 0.36, -6, 3, 6, 'rgba(255,255,255,0.18)');
      rr(g, len * 0.6, -7, len * 0.4, 7, 2, METAL);
      rr(g, len * 0.96 - 4, -9, 5, 11, 1, DARK);
      rr(g, len * 0.22, 2, 9, 19, 2, METAL);
      rr(g, -4, 2, 10, 14, 3, DARK);
      break;
    case 'ak47': case 'm16': case 'm14': case 'sawgun': {
      const stock = id === 'ak47' || id === 'm14' ? WOOD : DARK;
      rr(g, -len * 0.3, -8, len * 0.32, 12, 3, stock);
      rr(g, -len * 0.3, -9, 5, 14, 2, DARK);
      rr(g, -2, -10, len * 0.42, 13, 3, METAL);
      tick(g, len * 0.1, -8, len * 0.18, 2);
      rr(g, len * 0.4, -8, len * 0.28, 11, 3, id === 'm16' || id === 'sawgun' ? DARK : WOOD);
      if (id !== 'ak47' && id !== 'm14') for (let i = 0; i < 4; i++) tick(g, len * 0.44 + i * 5, -5, 2, 5, 'rgba(255,255,255,0.2)');
      rr(g, len * 0.66, -7, len * 0.34, 5, 2, METAL);
      rr(g, len * 0.96 - 3, -9, 6, 9, 1, DARK);
      rr(g, len * 0.5, -14, 4, 6, 1, DARK);
      if (id === 'm16') rr(g, len * 0.04, -15, len * 0.3, 6, 3, DARK); // carry handle
      if (id === 'ak47') shape(g, DARK, () => { g.moveTo(len * 0.22, 3); g.lineTo(len * 0.22 + 10, 3); g.quadraticCurveTo(len * 0.22 + 22, 12, len * 0.22 + 20, 22); g.lineTo(len * 0.22 + 9, 22); g.quadraticCurveTo(len * 0.22 + 11, 12, len * 0.22, 3); g.closePath(); });
      else if (id === 'sawgun') { rr(g, len * 0.22, 3, 22, 18, 3, GREEN); tick(g, len * 0.22 + 4, 7, 14, 2); tick(g, len * 0.22 + 4, 12, 14, 2); rr(g, len * 0.7, 4, 3, 14, 1, DARK); }
      else rr(g, len * 0.22, 3, 10, 18, 2, DARK);
      rr(g, -1, 3, 9, 14, 3, DARK);
      break;
    }
    case 'm93ba':
      rr(g, -len * 0.25, -8, len * 0.27, 12, 3, DARK);
      rr(g, -2, -9, len * 0.4, 12, 3, METAL);
      rr(g, len * 0.38, -6, len * 0.62, 5, 2, DARK);
      rr(g, len * 0.96 - 4, -8, 8, 9, 2, DARK);
      rr(g, len * 0.22, -19, len * 0.32, 10, 5, '#2b2f36');
      shape(g, '#8fc3e6', () => g.ellipse(len * 0.54, -14, 2.6, 4.2, 0, 0, Math.PI * 2), 1.4);
      tick(g, len * 0.3, -17, len * 0.1, 2, 'rgba(255,255,255,0.35)');
      rr(g, len * 0.28, 4, 9, 9, 2, DARK);
      break;
    case 'shotgun':
      rr(g, -len * 0.28, -8, len * 0.3, 12, 3, WOOD);
      rr(g, -2, -9, len * 0.3, 11, 3, METAL);
      rr(g, len * 0.26, -7, len * 0.74, 6, 2, DARK);
      rr(g, len * 0.26, -1, len * 0.7, 3, 1, METAL);
      rr(g, len * 0.42, -2, len * 0.22, 9, 3, WOOD);
      tick(g, len * 0.46, 1, len * 0.14, 1.5);
      break;
    case 'smaw':
      rr(g, -len * 0.2, -11, len * 1.0, 18, 7, GREEN);
      tick(g, len * 0.15, -11, 3, 18); tick(g, len * 0.55, -11, 3, 18);
      rr(g, len * 0.76, -14, 13, 24, 3, DARK);
      rr(g, -len * 0.22, -13, 9, 22, 3, DARK);
      rr(g, len * 0.1, -18, 15, 7, 2, DARK);
      shape(g, '#c0392b', () => g.rect(len * 0.34, -11, 8, 18), 1.5);
      rr(g, -4, 6, 10, 15, 3, DARK);
      break;
    case 'emp':
      rr(g, -len * 0.18, -10, len * 0.7, 19, 6, METAL);
      for (let i = 0; i < 3; i++) rr(g, len * 0.4 + i * 9, -14, 7, 27, 3, i === 2 ? accent : '#a9d3ee');
      shape(g, 'rgba(120,200,255,0.8)', () => g.arc(len * 0.4 + 22, -0.5, 4.5, 0, Math.PI * 2), 1.2);
      rr(g, -4, 6, 10, 15, 3, DARK);
      break;
    case 'flame':
      rr(g, -len * 0.2, -24, 26, 36, 10, '#c0602a');
      tick(g, -len * 0.2 + 4, -14, 18, 2, 'rgba(255,255,255,0.3)');
      rr(g, 0, -8, len * 0.8, 10, 3, DARK);
      rr(g, len * 0.7, -11, 13, 16, 3, METAL);
      shape(g, '#ffb13b', () => { g.moveTo(len * 0.7 + 13, -4); g.quadraticCurveTo(len * 0.7 + 22, -6, len * 0.7 + 24, -3); g.quadraticCurveTo(len * 0.7 + 20, 0, len * 0.7 + 13, -1); g.closePath(); }, 1.3);
      rr(g, -4, 3, 10, 15, 3, DARK);
      break;
    case 'riot':
      rr(g, 12, -36, 11, 74, 5, '#7b93ad');
      rr(g, 14, -24, 7, 22, 3, '#b9d6ea');
      for (const yy of [-31, 28]) { shape(g, '#d8e2ea', () => g.arc(17.5, yy, 1.8, 0, Math.PI * 2), 1); }
      rr(g, -2, -5, 15, 9, 3, DARK);
      break;
  }
  g.restore();
}
