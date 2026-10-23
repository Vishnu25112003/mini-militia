import { createPlayer, emptyInput } from '../logic/player';
import type { CollisionMap } from '../physics/collision';
import type { PlayerInput, PlayerState } from '../types';

/** Build a collision map from ASCII rows: '#' = solid, anything else = empty. Outside the map is solid. */
export function makeMap(rows: string[], tileSize = 32): CollisionMap {
  const heightTiles = rows.length;
  const widthTiles = rows[0].length;
  return {
    tileSize,
    widthTiles,
    heightTiles,
    isSolid(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= widthTiles || ty >= heightTiles) return true;
      return rows[ty][tx] === '#';
    },
  };
}

/** An open room: solid border, empty inside. */
export function openRoom(w: number, h: number, tileSize = 32): CollisionMap {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    rows.push(y === 0 || y === h - 1 ? '#'.repeat(w) : '#' + '.'.repeat(w - 2) + '#');
  }
  return makeMap(rows, tileSize);
}

export function testPlayer(over: Partial<PlayerState> = {}): PlayerState {
  const base = createPlayer({
    id: 'p1',
    name: 'Tester',
    color: 0,
    x: 100,
    y: 100,
    slots: [
      { kind: 'single', gun: 'ak47', ammo: { magazine: 30, reserve: 90 } },
      { kind: 'single', gun: 'm14', ammo: { magazine: 15, reserve: 45 } },
    ],
  });
  return { ...base, ...over };
}

export const input = (over: Partial<PlayerInput> = {}): PlayerInput => ({ ...emptyInput(), ...over });

/** Deterministic pseudo-random numbers in [0,1) for tests. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
