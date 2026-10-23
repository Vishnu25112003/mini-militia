# Legacy prototype (kept intact)

`prototype/` is the first version of this project, built before the WAN plan existed:

- solo mode with bots **and** LAN/room-code multiplayer
- custom Canvas2D renderer, custom `ws` server at 60 Hz
- 13 weapons, 3 modes (DM / TDM / CTF), A\* bots, procedural art and synthesised sound

The v1 plan ([`../Mini-Militia-WAN-Plan/`](../Mini-Militia-WAN-Plan/00%20Index.md)) is **WAN multiplayer only** on
Phaser + React + Colyseus, so this code is no longer built or run. It stays here so nothing is lost and so useful
pieces (soldier / weapon drawing in `src/game/soldierArt.ts` and `art.ts`, synthesised sounds in `audio.ts`, bot AI
and navigation in `ai.ts` / `nav.ts`) can be ported in later phases.

A zip of the whole prototype was also saved outside the repo: `../../Catacombs-prototype-backup.zip`.

## Important: the prototype map is not for the new game

`prototype/src/game/maps/catacombs.json` and `prototype/scripts/build-map.mjs` derive level geometry (collision
grid, spawn and pickup positions) from the original Android game's data. The plan (Phase 02) requires an **original**
map design, so the new game does **not** use this data, and it should not be published or shipped.
