/**
 * The placeholder tileset shared by the generator (writes tileset.png and
 * catacombs.json) and the loader (reads catacombs.json back). Local tile ids
 * are 0-indexed within the tileset image; GIDs in the Tiled JSON are
 * `firstgid + localId`.
 */
export const TILE_SIZE = 32;

export const TILESET_FIRST_GID = 1;

export const TILE_LOCAL_IDS = {
  background: 0,
  wall: 1,
  platform: 2,
  caveEdge: 3,
} as const;

export type TileName = keyof typeof TILE_LOCAL_IDS;

export const TILESET_COLUMNS = 4;
export const TILESET_TILE_COUNT = Object.keys(TILE_LOCAL_IDS).length;

/** Which placeholder tiles block movement — set as a `solid` custom property per-tile in the Tiled JSON. */
export const SOLID_TILES: ReadonlySet<TileName> = new Set(['wall', 'platform', 'caveEdge']);

export function gidFor(tile: TileName): number {
  return TILESET_FIRST_GID + TILE_LOCAL_IDS[tile];
}

/** A tile's surface color, for the generated placeholder tileset image. */
export const TILE_COLORS: Record<TileName, { r: number; g: number; b: number }> = {
  background: { r: 46, g: 38, b: 58 }, // dark cave-interior purple
  wall: { r: 92, g: 84, b: 102 }, // mid-gray rock
  platform: { r: 122, g: 110, b: 90 }, // warm stone
  caveEdge: { r: 58, g: 52, b: 44 }, // near-black boundary rock
};
