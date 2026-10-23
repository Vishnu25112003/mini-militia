# Map files

| File                          | What it is                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `catacombs.tmj`               | **Tiled source file.** Open this in [Tiled](https://www.mapeditor.org/) to edit.              |
| `catacombs.json`              | The same map exported as JSON. **This is what the game loads** (server and client).           |
| `tileset.png`                 | Placeholder 32 px tileset (wall, platform, background, cave edge). Replaced in Phase 15.      |
| `catacombs.layout.txt`        | ASCII sketch of the layout (`#` wall, `=` platform, `S` spawn, `P` pickup).                   |
| `loadMap.ts`                  | Turns the Tiled JSON into a collision grid + spawn list + pickup list (pure, no file access). |
| `validateMap.ts`              | The checks (counts, spacing, solid tiles, closed boundary, reachability).                     |
| `validate.ts`                 | Runs the checks on `catacombs.json`; fails the build if any check fails.                      |
| `catacombs.ts`                | The loaded map for code to import: `CATACOMBS` (and the raw `CATACOMBS_JSON`).                |
| `tools/generate-catacombs.ts` | Script that created all of the above (original design, mirror-symmetric).                     |

## Layers (Tiled)

- `background` — visual only.
- `collision` — solid tiles. A tile is solid when its tileset tile has the custom property `solid = true` (wall, platform and cave edge are; background is not).
- `spawnPoints` — **16** point objects. The point is where the feet start, just above the floor.
- `pickupSpots` — **14** point objects. The point is the centre of the item.

## Rules (Game Flow, Section 16)

100 × 60 tiles of 32 px · 16 spawn points · 14 pickup spots · every spawn point at least 160 px (5 tiles) from every pickup spot · the boundary is fully closed · everything reachable with walking + jetpack.
These numbers live in `shared/config/map.ts`.

## Commands

```bash
npm run validate-map -w @game/shared    # check the map (also runs inside `npm run build`)
npm run generate-map -w @game/shared    # regenerate the files from the script
```

## Editing by hand in Tiled — read this first

`generate-map` **overwrites** `catacombs.tmj` and `catacombs.json`. If you start editing the map by hand in Tiled
(for example during playtesting in Phase 16), **stop using `generate-map`** from then on, or your edits are lost.
After editing in Tiled: _File → Export As → JSON_ into `catacombs.json`, then run `npm run validate-map -w @game/shared`.

Note: the map was written by the script in Tiled's file format; it has been checked by the game's own loader and
validator, but has not yet been opened in the Tiled application itself.
