import { MAP } from './map';
import { PLAYER_H, PLAYER_W } from './sim';

// Coarse navigation grid: a node is passable when a soldier-sized body fits there.
// 8px nodes: at 16px the grid missed tunnels that the 56px-tall soldier can really pass through.
const NODE = 8;
const NC = Math.ceil(MAP.width / NODE);
const NR = Math.ceil(MAP.height / NODE);

const free = new Uint8Array(NC * NR);
const grounded = new Uint8Array(NC * NR);
for (let y = 0; y < NR; y++) for (let x = 0; x < NC; x++) {
  const cx = x * NODE + NODE / 2, cy = y * NODE + NODE / 2;
  if (!MAP.rectSolid(cx - PLAYER_W / 2 + 1, cy - PLAYER_H / 2 + 1, PLAYER_W - 2, PLAYER_H - 2)) {
    free[y * NC + x] = 1;
    if (MAP.rectSolid(cx - PLAYER_W / 2, cy + PLAYER_H / 2 + 1, PLAYER_W, 3)) grounded[y * NC + x] = 1;
  }
}

const idx = (x: number, y: number) => y * NC + x;
const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < NC && y < NR && free[idx(x, y)] === 1;

function nearestFree(px: number, py: number): number {
  const sx = Math.max(0, Math.min(NC - 1, Math.floor(px / NODE)));
  const sy = Math.max(0, Math.min(NR - 1, Math.floor(py / NODE)));
  if (ok(sx, sy)) return idx(sx, sy);
  for (let r = 1; r < 12; r++) {
    let best = -1, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !ok(sx + dx, sy + dy)) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = idx(sx + dx, sy + dy); }
    }
    if (best >= 0) return best;
  }
  return -1;
}

const NEIGH: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41],
];

const g = new Float32Array(NC * NR);
const came = new Int32Array(NC * NR);
const stamp = new Uint32Array(NC * NR);
const closed = new Uint32Array(NC * NR);
let run = 0;

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop(): number {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

/** A* path in world coordinates (node centres), or null when unreachable. */
export function findPath(sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] | null {
  const s = nearestFree(sx, sy), t = nearestFree(tx, ty);
  if (s < 0 || t < 0) return null;
  run++;
  const tX = t % NC, tY = (t / NC) | 0;
  const open = new MinHeap();
  g[s] = 0; stamp[s] = run; came[s] = -1;
  open.push(0, s);
  let steps = 0;
  while (open.size && steps++ < 160000) {
    const cur = open.pop();
    if (closed[cur] === run) continue;
    closed[cur] = run;
    if (cur === t) break;
    const cx = cur % NC, cy = (cur / NC) | 0;
    for (const [dx, dy, c] of NEIGH) {
      const nx = cx + dx, ny = cy + dy;
      if (!ok(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
      const n = idx(nx, ny);
      // climbing and hovering burn fuel, so prefer solid footing
      const cost = c + (dy < 0 ? 1.6 : 0) + (grounded[n] ? 0 : 0.6);
      const ng = g[cur] + cost;
      if (stamp[n] !== run || ng < g[n]) {
        stamp[n] = run; g[n] = ng; came[n] = cur;
        const h = Math.hypot(nx - tX, ny - tY) * 1.15; // slightly weighted: much faster, paths stay near-optimal
        open.push(ng + h, n);
      }
    }
  }
  if (closed[t] !== run) return null;
  const path: { x: number; y: number }[] = [];
  for (let n = t; n >= 0; n = came[n]) path.push({ x: (n % NC) * NODE + NODE / 2, y: ((n / NC) | 0) * NODE + NODE / 2 });
  return path.reverse();
}
