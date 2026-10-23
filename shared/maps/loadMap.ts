import type { CollisionMap } from '../physics/collision';

// Loads a Tiled JSON map into what the game needs: a collision grid plus the spawn and pickup lists.
// Pure (no file access), so the server, the browser and the validator all use the same code.

export interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

export interface TiledObject {
  id: number;
  name?: string;
  x: number;
  y: number;
  point?: boolean;
}

export type TiledLayer =
  | { type: 'tilelayer'; name: string; width: number; height: number; data: number[] }
  | { type: 'objectgroup'; name: string; objects: TiledObject[] }
  | { type: string; name: string };

export interface TiledTileset {
  firstgid: number;
  tilecount: number;
  tiles?: { id: number; properties?: TiledProperty[] }[];
}

/** The parts of a Tiled map export that we read. */
export interface TiledMapJson {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface LoadedMap {
  tileSize: number;
  widthTiles: number;
  heightTiles: number;
  widthPx: number;
  heightPx: number;
  /** One byte per tile, row by row: 1 = solid. */
  solid: Uint8Array;
  /** What physics uses. Anything outside the map counts as solid. */
  collision: CollisionMap;
  spawnPoints: Vec2[];
  pickupSpots: Vec2[];
}

// Tiled stores flip flags in the top bits of a tile id
const GID_MASK = 0x1fffffff;

function findLayer<K extends 'tilelayer' | 'objectgroup'>(
  map: TiledMapJson,
  name: string,
  type: K,
): Extract<TiledLayer, { type: K }> {
  const layer = map.layers.find((l) => l.name === name && l.type === type);
  if (!layer) throw new Error(`map has no ${type} named "${name}"`);
  return layer as Extract<TiledLayer, { type: K }>;
}

export function loadMap(json: TiledMapJson): LoadedMap {
  if (json.tilewidth !== json.tileheight) throw new Error('map tiles must be square');
  const widthTiles = json.width;
  const heightTiles = json.height;
  const tileSize = json.tilewidth;

  // which tile ids are solid: tileset tiles with the custom property solid = true
  const solidGids = new Set<number>();
  for (const ts of json.tilesets) {
    for (const tile of ts.tiles ?? []) {
      if (tile.properties?.some((p) => p.name === 'solid' && p.value === true)) {
        solidGids.add(ts.firstgid + tile.id);
      }
    }
  }

  const layer = findLayer(json, 'collision', 'tilelayer');
  if (layer.data.length !== widthTiles * heightTiles) throw new Error('collision layer has the wrong size');
  const solid = new Uint8Array(widthTiles * heightTiles);
  for (let i = 0; i < solid.length; i++) solid[i] = solidGids.has(layer.data[i] & GID_MASK) ? 1 : 0;

  const points = (name: string): Vec2[] =>
    [...findLayer(json, name, 'objectgroup').objects]
      .sort((a, b) => a.id - b.id)
      .map((o) => ({ x: o.x, y: o.y }));

  const collision: CollisionMap = {
    tileSize,
    widthTiles,
    heightTiles,
    isSolid(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= widthTiles || ty >= heightTiles) return true;
      return solid[ty * widthTiles + tx] === 1;
    },
  };

  return {
    tileSize,
    widthTiles,
    heightTiles,
    widthPx: widthTiles * tileSize,
    heightPx: heightTiles * tileSize,
    solid,
    collision,
    spawnPoints: points('spawnPoints'),
    pickupSpots: points('pickupSpots'),
  };
}
