import type { CollisionMap } from '../physics/map.js';
import { TILESET_FIRST_GID, TILE_SIZE } from './tileset.js';

export interface MapPoint {
  id: string;
  x: number;
  y: number;
}

export interface LoadedMap {
  collisionMap: CollisionMap;
  spawnPoints: MapPoint[];
  pickupSpots: MapPoint[];
}

interface TiledPointObject {
  id: number;
  name: string;
  x: number;
  y: number;
}

interface TiledTileLayer {
  type: 'tilelayer';
  name: string;
  width: number;
  height: number;
  data: number[];
}

interface TiledObjectLayer {
  type: 'objectgroup';
  name: string;
  objects: TiledPointObject[];
}

export interface TiledMapJson {
  width: number;
  height: number;
  tilewidth: number;
  layers: (TiledTileLayer | TiledObjectLayer)[];
}

function getTileLayer(map: TiledMapJson, name: string): TiledTileLayer {
  const layer = map.layers.find(
    (l): l is TiledTileLayer => l.type === 'tilelayer' && l.name === name,
  );
  if (!layer) throw new Error(`Map is missing the "${name}" tile layer`);
  return layer;
}

function getObjectLayer(map: TiledMapJson, name: string): TiledObjectLayer {
  const layer = map.layers.find(
    (l): l is TiledObjectLayer => l.type === 'objectgroup' && l.name === name,
  );
  if (!layer) throw new Error(`Map is missing the "${name}" object layer`);
  return layer;
}

/**
 * Builds the `CollisionMap` physics needs, plus the spawn/pickup point
 * lists, straight from a parsed Tiled JSON map — the same file the client
 * loads for rendering, so server and client can never disagree about
 * geometry.
 */
export function loadMap(map: TiledMapJson): LoadedMap {
  const collision = getTileLayer(map, 'collision');
  if (map.tilewidth !== TILE_SIZE) {
    throw new Error(`Expected ${TILE_SIZE}px tiles, got ${map.tilewidth}px`);
  }

  const collisionMap: CollisionMap = {
    tileSize: map.tilewidth,
    widthInTiles: map.width,
    heightInTiles: map.height,
    isSolidTile(tileX, tileY) {
      if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return false;
      const gid = collision.data[tileY * map.width + tileX] ?? 0;
      return gid >= TILESET_FIRST_GID;
    },
  };

  const spawnPoints = getObjectLayer(map, 'spawnPoints').objects.map((o) => ({
    id: o.name,
    x: o.x,
    y: o.y,
  }));
  const pickupSpots = getObjectLayer(map, 'pickupSpots').objects.map((o) => ({
    id: o.name,
    x: o.x,
    y: o.y,
  }));

  return { collisionMap, spawnPoints, pickupSpots };
}
