---
phase: 2
title: Map (Catacombs-style)
status: not-started
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
- [ ] Create a simple 32 px tileset image: solid wall, platform, background, cave edge (plain colors — placeholder art)
- [ ] Mark which tiles are **solid** (tile property `solid = true`)

### 2. Layout design (paper first)
- [ ] Sketch the layout on paper/grid: octagon-like outer boundary, cave tunnels along top and bottom, grid of cross-shaped corridors, central block, **mirror symmetry**
- [ ] Make sure every area is reachable with walking + jetpack
- [ ] Keep it **original** — same structure and feel, not a copy of the original map's exact shapes

### 3. Build in Tiled
- [ ] Layer `background` (visual only)
- [ ] Layer `collision` (solid tiles)
- [ ] Object layer `spawnPoints` — **16** point objects
- [ ] Object layer `pickupSpots` — **14** point objects
- [ ] Export JSON → `shared/maps/catacombs.json`

### 4. Validation script (`shared/maps/validate.ts`)
- [ ] Exactly 16 spawn points and 14 pickup spots
- [ ] Every spawn point ≥ 160 px from every pickup spot
- [ ] No spawn point or pickup spot inside a solid tile
- [ ] Map boundary fully closed (players can't fly out)
- [ ] Runs automatically in the build — fails if any check fails

### 5. Loaders
- [ ] `shared/maps/loadMap.ts` → collision grid + spawn list + pickup list (used by server and physics)
- [ ] Client: Phaser loads the same JSON and draws the tile layers
- [ ] Debug overlay toggle: shows spawn points (one color) and pickup spots (another color)

## Deliverables
- `catacombs.json` + tileset in `shared/maps/`
- Validation script passing
- Map visible in the browser with debug markers

## Acceptance criteria
- [ ] Map renders correctly in Phaser on phone and PC
- [ ] Validation passes (counts, spacing, closed boundary)
- [ ] The server can load the same file and answer "is this tile solid?"

## Risks & notes
- Map layout will be tuned again in Phase 16 after real play — keep the Tiled source file (`.tmx`/`.tmj`) in the repo.
- If 100 × 60 feels too big or small with 8 players, adjust during playtesting (with Dev4's approval).

## Approval gate
- [ ] All acceptance criteria met
- [ ] **Dev4 approval to move to Phase 03**
