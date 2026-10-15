---
phase: 2
title: Map (Catacombs-style)
status: done
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
- [x] Sketch the layout on paper/grid: octagon-like outer boundary, cave tunnels along top and bottom, grid of cross-shaped corridors, central block, **mirror symmetry** — done as a precise algorithmic spec instead of a paper sketch (see decisions log: no Tiled GUI in this environment)
- [x] Make sure every area is reachable with walking + jetpack — verified by an automated flood-fill check, not just by eye
- [x] Keep it **original** — same structure and feel, not a copy of the original map's exact shapes

### 3. Build in Tiled
- [x] Layer `background` (visual only)
- [x] Layer `collision` (solid tiles)
- [x] Object layer `spawnPoints` — **16** point objects
- [x] Object layer `pickupSpots` — **14** point objects
- [x] Export JSON → `shared/maps/catacombs.json` — generated directly in valid Tiled JSON format by code (`shared/maps/generate.ts`), not exported from the Tiled GUI (see decisions log)

### 4. Validation script (`shared/maps/validate.ts`)
- [x] Exactly 16 spawn points and 14 pickup spots
- [x] Every spawn point ≥ 160 px from every pickup spot
- [x] No spawn point or pickup spot inside a solid tile
- [x] Map boundary fully closed (players can't fly out)
- [x] Runs automatically in the build — fails if any check fails (wired as `shared`'s `prebuild` npm script)
- [x] Bonus: flood-fill reachability check (every open tile reachable by flying), to actually verify the "every area is reachable" layout requirement rather than assume it

### 5. Loaders
- [x] `shared/src/maps/loadMap.ts` → collision grid + spawn list + pickup list (used by server and physics) — lives under `src/` rather than the top-level `maps/` folder since it's genuine runtime library code (needed by client-side prediction later, not just a build tool), and is exported from `@game/shared`
- [x] Client: Phaser loads the same JSON and draws the tile layers
- [x] Debug overlay toggle: shows spawn points (one color) and pickup spots (another color) — press **M**

## Deliverables
- `catacombs.json` + tileset in `shared/maps/`
- Validation script passing
- Map visible in the browser with debug markers

## Acceptance criteria
- [ ] Map renders correctly in Phaser on phone and PC — **needs Dev4 to verify visually**; this agent's browser tool can't reach this machine's localhost (same limitation noted in Phase 00). Run `npm run dev` and open the client URL — the map should render with an octagon-ish boundary, top/bottom tunnels, a cross-corridor grid, and a central block; press **M** to see the green/yellow spawn and pickup markers.
- [x] Validation passes (counts, spacing, closed boundary) — `npm run validate-map --workspace=shared`, also enforced automatically as a `prebuild` step and covered by 6 Vitest tests
- [x] The server can load the same file and answer "is this tile solid?" — verified live via `GET /map-info` on the running server

## Risks & notes
- Map layout will be tuned again in Phase 16 after real play — keep the Tiled source file (`.tmx`/`.tmj`) in the repo.
- If 100 × 60 feels too big or small with 8 players, adjust during playtesting (with Dev4's approval).

## Notes / decisions log
- 2026-10-15: No Tiled GUI was available in this environment, so the map was authored a different way: `shared/maps/generate.ts` builds the layout algorithmically (quadrant generated once, mirrored 4 ways for guaranteed symmetry) and writes it straight out as a real, valid Tiled JSON file — not a GUI export, but byte-for-byte the same format, openable in actual Tiled. This also made the map **fully deterministic** (no RNG anywhere) and **automatically reachability-checked** (a flood fill proves every open tile connects, rather than eyeballing a paper sketch).
- Placing the 16 spawn points and 14 pickup spots to satisfy "every spawn ≥160px from every pickup" was initially buggy: scanning for spawn seeds and pickup seeds independently, from the same starting corner, reliably put them too close together regardless of how much same-category spacing was enforced. Fixed by placing pickups first, then searching for spawn positions that are explicitly checked against every already-placed pickup.
- Moved `loadMap.ts`/`tileset.ts` into `shared/src/maps/` (compiled, exported from `@game/shared`) rather than leaving them in the top-level `shared/maps/` tooling folder — they're genuine runtime code the client will also need for client-side movement prediction in Phase 03/04, not just a build-time concern. The generator and validator CLI stayed in `shared/maps/` since those are Node-only build tools.
- Added `"./maps/catacombs.json"` and `"./maps/tileset.png"` to `@game/shared`'s package `exports`, so both the server (`require.resolve`) and the client (a normal Vite import, no `public/` copy step needed) load the exact same files directly from the shared package.
- Generated a `shared/maps/debug-preview.png` (small rasterized top-down view, color-coded by tile kind plus spawn/pickup dots) as a way to sanity-check the layout without a browser — worth regenerating (`npm run generate-map --workspace=shared`) and opening whenever the layout rules change.

## Approval gate
- [ ] All acceptance criteria met — blocked only on Dev4's visual check
- [ ] **Dev4 approval to move to Phase 03**
