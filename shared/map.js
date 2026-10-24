// Collision grid built by tools/extract.mjs from the alpha of the TMX "tile" layer.
// One bit per 4x4 world-point cell; y grows downward like the TMX.

const decodeBase64 = (s) => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export class GameMap {
  constructor(json) {
    this.json = json;
    const c = json.collision;
    this.cell = c.cell;
    this.cols = c.cols;
    this.rows = c.rows;
    this.bits = decodeBase64(c.bits);
    this.width = json.width * json.tile;
    this.height = json.height * json.tile;
    this.objects = json.objects;
  }

  solidCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 1;
    const i = cy * this.cols + cx;
    return (this.bits[i >> 3] >> (i & 7)) & 1;
  }

  solidAt(x, y) {
    return this.solidCell(Math.floor(x / this.cell), Math.floor(y / this.cell));
  }

  // Axis-aligned rectangle (left, top, right, bottom) overlaps any solid cell?
  rectSolid(l, t, r, b) {
    const c = this.cell;
    const x0 = Math.floor(l / c), x1 = Math.floor((r - 0.001) / c);
    const y0 = Math.floor(t / c), y1 = Math.floor((b - 0.001) / c);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.solidCell(x, y)) return true;
    return false;
  }

  // Grid walk (Amanatides & Woo). Returns distance to the first solid cell along the ray, or maxDist.
  raycast(x, y, dx, dy, maxDist) {
    const c = this.cell;
    let cx = Math.floor(x / c), cy = Math.floor(y / c);
    if (this.solidCell(cx, cy)) return 0;
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(c / dx) : Infinity;
    const tDY = dy !== 0 ? Math.abs(c / dy) : Infinity;
    let tX = dx !== 0 ? ((dx > 0 ? (cx + 1) * c - x : x - cx * c) / Math.abs(dx)) : Infinity;
    let tY = dy !== 0 ? ((dy > 0 ? (cy + 1) * c - y : y - cy * c) / Math.abs(dy)) : Infinity;
    for (;;) {
      let t;
      if (tX < tY) { t = tX; tX += tDX; cx += stepX; } else { t = tY; tY += tDY; cy += stepY; }
      if (t > maxDist) return maxDist;
      if (this.solidCell(cx, cy)) return t;
    }
  }

  lineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    return this.raycast(x0, y0, dx / d, dy / d, d) >= d - 0.5;
  }

  byPrefix(prefix) {
    return this.objects.filter((o) => o.name.startsWith(prefix));
  }
}
