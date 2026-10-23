---
phase: 2
title: Map (Catacombs-style)
status: in-progress
depends_on: [1]
tags: [phase, map, tiled]
---

# Phase 02 — Map (Catacombs-style, original design)

← [[Phase 01 - Shared Core]] | Next → [[Phase 03 - Local Movement Sandbox]]

## Goal
Design and build **your own original map** with the Catacombs structure in **Tiled**, export it as one JSON file in `shared/`, and load it on both the client (drawing) and server (collision).

## Flow references
- [[Game Flow#16. Map (Catacombs-style, original design)]]
- [[Game Flow#6. Map Pickups (Guns & Medkits)]]
- [[Game Flow#3. Spawning]]

## Fixed decisions
| Item | Value |
|---|---|
| Editor | Tiled |
| Tile size | 32 × 32 px |
| Map size | ~100 × 60 tiles (3200 × 1920 px) |
| Spawn points | 16, spread symmetrically |
| Pickup spots | 14 |
| Spacing | every spawn point ≥ **5 tiles (160 px)** from every pickup spot |
| Spawn rule | purely random among spawn points |
| File | one JSON in `shared/maps/` |

## Tasks

### 1. Placeholder tileset
- [x] Create a simple 32 px tileset image: solid wall, platform, background, cave edge (plain colors — placeholder art)
- [x] Mark which tiles are **solid** (tile property `solid = true`)

### 2. Layout design (paper first)
- [x] Sketch the layout on paper/grid: octagon-like outer boundary, cave tunnels along top and bottom, grid of cross-shaped corridors, central block, **mirror symmetry**
- [x] Make sure every area is reachable with walking + jetpack
- [x] Keep it **original** — same structure and feel, not a copy of the original map's exact shapes

### 3. Build in Tiled
- [x] Layer `background` (visual only)
- [x] Layer `collision` (solid tiles)
- [x] Object layer `spawnPoints` — **16** point objects
- [x] Object layer `pickupSpots` — **14** point objects
- [x] Export JSON → `shared/maps/catacombs.json`

### 4. Validation script (`shared/maps/validate.ts`)
- [x] Exactly 16 spawn points and 14 pickup spots
- [x] Every spawn point ≥ 160 px from every pickup spot
- [x] No spawn point or pickup spot inside a solid tile
- [x] Map boundary fully closed (players can't fly out)
- [x] Runs automatically in the build — fails if any check fails

### 5. Loaders
- [x] `shared/maps/loadMap.ts` → collision grid + spawn list + pickup list (used by server and physics)
- [x] Client: Phaser loads the same JSON and draws the tile layers
- [x] Debug overlay toggle: shows spawn points (one color) and pickup spots (another color)

## Deliverables
- `catacombs.json` + tileset in `shared/maps/`
- Validation script passing
- Map visible in the browser with debug markers

## Acceptance criteria
- [ ] Map renders correctly in Phaser on phone and PC
- [x] Validation passes (counts, spacing, closed boundary)
- [x] The server can load the same file and answer "is this tile solid?"

## Risks & notes
- Map layout will be tuned again in Phase 16 after real play — keep the Tiled source file (`.tmx`/`.tmj`) in the repo.
- If 100 × 60 feels too big or small with 8 players, adjust during playtesting (with Dev4's approval).

## Notes / decisions log

**Built 2026-10-23 — everything except the phone check.** `shared/maps/` holds the map, the tileset, the loader, the validator and the generator; `shared/maps/README.md` explains each file. Verified: `npm run validate-map` passes (16 spawns, 14 pickups, minimum spawn-pickup distance 256 px, closed boundary, **50,272 / 50,272** open positions reachable), 23 map tests pass (incl. 9 that break the map on purpose and expect the validator to catch it), and Chrome renders the map from the same JSON with the debug overlay (`http://localhost:5173/?scene=map`, press **G** to toggle, WASD / drag to pan, wheel to zoom).

**Layout (original design, mirror-symmetric left to right):** octagon boundary with 45° corner cuts · cave tunnels along the top and bottom with stalactites / stalagmites · a 5-column grid of blocks forming cross-shaped corridors (6 tiles wide) · a central block between two central column pieces · ledges and floating platforms for jetpack play. The ASCII sketch is `shared/maps/catacombs.layout.txt`.

**Spawn / pickup placement:** 8 + 8 mirrored spawn points and 7 + 7 mirrored pickup spots, all standing on floors; mirrored left to right only (top/bottom mirroring would put points under ceilings). Spawn point = where the feet start (2 px above the floor); pickup spot = the item's centre.

**Honest caveats**
- The map file was **written by a script in Tiled's JSON format**, not drawn in the Tiled application. It is read correctly by the game's loader and by Phaser, but I have not opened it in Tiled itself — please open `shared/maps/catacombs.tmj` once to confirm. **If you hand-edit in Tiled, stop running `generate-map`** (it overwrites the files); export JSON from Tiled instead.
- This map is **new and original**; it is not derived from any other game's data. (The earlier prototype's map data stays quarantined in `legacy/` and is not used.)
- Tileset art is plain placeholder colours (replaced in Phase 15).

**Still to do for this phase:** open the map on a **phone** (landscape) and confirm it renders correctly — the only unchecked acceptance item. (`npm run dev`, then open `http://<your-PC-IP>:5173/?scene=map` on the phone.)

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 03**
