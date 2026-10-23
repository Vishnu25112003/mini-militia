import raw from './maps/catacombs.json';
import type { ItemId } from './types';

interface RawMap {
  name: string;
  cell: number;
  cols: number;
  rows: number;
  solid: string[];
  back: string[];
  spawns: { x: number; y: number }[];
  ctfSpawns: { team: number; x: number; y: number }[];
  pickups: { id: string; x: number; y: number; pool: string[] }[];
  flags: { team: number; x: number; y: number }[];
}

const data = raw as RawMap;

function toGrid(rows: string[]): Uint8Array {
  const g = new Uint8Array(data.cols * data.rows);
  for (let y = 0; y < data.rows; y++) for (let x = 0; x < data.cols; x++) g[y * data.cols + x] = rows[y].charCodeAt(x) === 49 ? 1 : 0;
  return g;
}

export class GameMap {
  readonly name = data.name;
  readonly cell = data.cell;
  readonly cols = data.cols;
  readonly rows = data.rows;
  readonly width = data.cols * data.cell;
  readonly height = data.rows * data.cell;
  readonly solid = toGrid(data.solid);
  readonly back = toGrid(data.back);
  readonly spawns = data.spawns;
  readonly ctfSpawns = data.ctfSpawns;
  readonly flags = data.flags;
  readonly pickups = data.pickups.map((p) => ({ ...p, pool: p.pool as ItemId[] }));

  /** Out-of-bounds counts as solid so nothing leaves the arena. */
  isSolidCell(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.solid[cy * this.cols + cx] === 1;
  }

  isSolid(px: number, py: number): boolean {
    return this.isSolidCell(Math.floor(px / this.cell), Math.floor(py / this.cell));
  }

  /** Any solid cell inside the rect (top-left x,y). */
  rectSolid(x: number, y: number, w: number, h: number): boolean {
    const c = this.cell;
    const x0 = Math.floor(x / c), x1 = Math.floor((x + w - 0.001) / c);
    const y0 = Math.floor(y / c), y1 = Math.floor((y + h - 0.001) / c);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (this.isSolidCell(cx, cy)) return true;
    return false;
  }

  /** True when the straight line is blocked by terrain. */
  blocked(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.ceil(Math.hypot(dx, dy) / (this.cell * 0.75));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.isSolid(x0 + dx * t, y0 + dy * t)) return true;
    }
    return false;
  }
}

export const MAP = new GameMap();
