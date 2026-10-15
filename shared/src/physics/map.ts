/**
 * The minimal view of the map physics needs. The real map (Phase 02) will
 * implement this against the Tiled JSON; tests implement it against a tiny
 * fake grid.
 */
export interface CollisionMap {
  tileSize: number;
  widthInTiles: number;
  heightInTiles: number;
  isSolidTile(tileX: number, tileY: number): boolean;
}
