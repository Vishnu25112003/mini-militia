import { loadMap, type TiledMapJson } from './loadMap';
import catacombsJson from './catacombs.json';

/** The raw Tiled export (what Phaser loads on the client). */
export const CATACOMBS_JSON = catacombsJson as unknown as TiledMapJson;

/** The map ready for physics, spawning and pickups (server and browser). */
export const CATACOMBS = loadMap(CATACOMBS_JSON);
