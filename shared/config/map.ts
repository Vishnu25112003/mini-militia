// Map rules. Source of truth: Game Flow, Section 16 "Map (Catacombs-style, original design)".

export const MAP_RULES = {
  tileSize: 32,
  widthTiles: 100,
  heightTiles: 60,
  /** Fixed spawn points; the spawn rule is purely random among them (no enemy-distance check). */
  spawnPointCount: 16,
  /** Fixed pickup spots; each refresh, every spot gets a random item. */
  pickupSpotCount: 14,
  /** Every spawn point must be at least this far (px) from every pickup spot: 5 tiles. */
  minSpawnPickupDistancePx: 160,
} as const;
