import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadMap, type TiledMapJson } from '@game/shared';

const require = createRequire(import.meta.url);

/** The same catacombs.json the client renders — one file, loaded independently by both. */
export function loadCatacombsMap() {
  const mapPath = require.resolve('@game/shared/maps/catacombs.json');
  const mapJson = JSON.parse(readFileSync(mapPath, 'utf-8')) as TiledMapJson;
  return loadMap(mapJson);
}
